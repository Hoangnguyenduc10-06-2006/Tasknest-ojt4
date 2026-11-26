package vn.tasknest.workservice;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.tasknest.workservice.api.WorkExceptionHandler;
import vn.tasknest.workservice.api.community.MessagingController;
import vn.tasknest.workservice.application.community.MessagingService;
import vn.tasknest.workservice.application.security.IdentitySessionVerifier;
import vn.tasknest.workservice.application.security.ProjectPermissionService;
import vn.tasknest.workservice.application.security.WorkActor;
import vn.tasknest.workservice.application.security.WorkRequestBudget;
import vn.tasknest.workservice.config.SecurityConfiguration;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = MessagingController.class, properties = {"spring.config.import=", "spring.cloud.config.enabled=false"})
@Import({SecurityConfiguration.class, WorkExceptionHandler.class})
class MessagingControllerTest {
    private static final String MESSAGES = "/api/work/community/chat/3/messages";
    private static final String IMAGE = MESSAGES + "/8/image";
    private static final String CLIENT_ID = "00000000-0000-4000-8000-000000000001";
    private final WorkActor actor = new WorkActor("00000000-0000-4000-8000-000000000002", true);

    @Autowired MockMvc mvc;
    @MockitoBean MessagingService chat;
    @MockitoBean IdentitySessionVerifier verifier;
    @MockitoBean WorkRequestBudget budget;
    @MockitoBean ProjectPermissionService permissions;

    @BeforeEach void session() {
        when(verifier.verify("valid")).thenReturn(actor);
        when(budget.consume(anyString(), anyString(), anyInt())).thenReturn(true);
    }

    @Test void multipartAllowsAnImageWithoutACaption() throws Exception {
        var file = new MockMultipartFile("file", "preview.png", "application/octet-stream", png());
        when(chat.sendImage(eq(actor), eq(3L), isNull(), eq(CLIENT_ID), any(), isNull())).thenReturn(8L);
        mvc.perform(multipart(MESSAGES).file(file).param("clientId", CLIENT_ID).header("Authorization", "Bearer valid"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data").value(8));
    }

    @Test void sendsAReplyWithoutChangingLegacyMessageRequests() throws Exception {
        when(chat.send(actor, 3L, "Reply", CLIENT_ID, 7L)).thenReturn(9L);
        mvc.perform(post(MESSAGES).contentType("application/json")
                .content("{\"body\":\"Reply\",\"clientId\":\"" + CLIENT_ID + "\",\"replyToMessageId\":7}")
                .header("Authorization", "Bearer valid"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data").value(9));
        verify(chat).send(actor, 3L, "Reply", CLIENT_ID, 7L);
        when(chat.send(actor, 3L, "Legacy", CLIENT_ID, null)).thenReturn(10L);
        mvc.perform(post(MESSAGES).contentType("application/json")
                .content("{\"body\":\"Legacy\",\"clientId\":\"" + CLIENT_ID + "\"}")
                .header("Authorization", "Bearer valid"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data").value(10));
        verify(chat).send(actor, 3L, "Legacy", CLIENT_ID, null);
    }

    @Test void rejectsSpoofedAndMoreThanFiveImagesBeforePersistence() throws Exception {
        var invalid = new MockMultipartFile("file", "preview.png", "image/png", "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        mvc.perform(multipart(MESSAGES).file(invalid).param("clientId", CLIENT_ID).header("Authorization", "Bearer valid"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FILE"));
        var png = new MockMultipartFile("file", "preview.png", "image/png", png());
        mvc.perform(multipart(MESSAGES).file(png).file(png).file(png).file(png).file(png).file(png)
                .param("clientId", CLIENT_ID).header("Authorization", "Bearer valid"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FILE"));
        verifyNoInteractions(chat);
    }

    @Test void acceptsUpToFiveImagesAsOneMessageAndKeepsSingleImageContract() throws Exception {
        var file = new MockMultipartFile("file", "preview.png", "application/octet-stream", png());
        when(chat.sendImages(eq(actor), eq(3L), eq("caption"), eq(CLIENT_ID), anyList(), isNull())).thenReturn(12L);
        mvc.perform(multipart(MESSAGES).file(file).file(file).file(file).file(file).file(file)
                .param("body", "caption").param("clientId", CLIENT_ID).header("Authorization", "Bearer valid"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data").value(12));
        verify(chat).sendImages(eq(actor), eq(3L), eq("caption"), eq(CLIENT_ID), anyList(), isNull());
        when(chat.sendImage(eq(actor), eq(3L), isNull(), eq(CLIENT_ID), any(), isNull())).thenReturn(13L);
        mvc.perform(multipart(MESSAGES).file(file).param("clientId", CLIENT_ID).header("Authorization", "Bearer valid"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data").value(13));
        verify(chat).sendImage(eq(actor), eq(3L), isNull(), eq(CLIENT_ID), any(), isNull());
    }

    @Test void returnsPrivateImageBytesOnlyThroughAuthenticatedRoute() throws Exception {
        mvc.perform(get(IMAGE)).andExpect(status().isUnauthorized());
        verifyNoInteractions(chat);
        byte[] bytes = png();
        when(chat.image(actor, 3L, 8L)).thenReturn(new MessagingService.ImageDownload("image/png", bytes));
        mvc.perform(get(IMAGE).header("Authorization", "Bearer valid"))
            .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(content().bytes(bytes));
        when(chat.image(actor, 3L, 8L, 2)).thenReturn(new MessagingService.ImageDownload("image/png", bytes));
        mvc.perform(get(MESSAGES + "/8/images/2").header("Authorization", "Bearer valid"))
            .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(bytes));
        verify(chat).image(actor, 3L, 8L, 2);
    }

    @Test void addsAndRemovesOnlyAuthenticatedMessageReactions() throws Exception {
        mvc.perform(put(MESSAGES + "/8/reaction").contentType("application/json").content("{\"emoji\":\"❤️\"}"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(chat);
        mvc.perform(put(MESSAGES + "/8/reaction").contentType("application/json").content("{\"emoji\":\"❤️\"}")
                .header("Authorization", "Bearer valid"))
            .andExpect(status().isOk());
        verify(chat).react(actor, 3L, 8L, "❤️");
        mvc.perform(delete(MESSAGES + "/8/reaction").contentType("application/json").content("{\"emoji\":\"❤️\"}")
                .header("Authorization", "Bearer valid"))
            .andExpect(status().isOk());
        verify(chat).unreact(actor, 3L, 8L, "❤️");
    }

    @Test void searchesMessagesOnlyForAnAuthenticatedConversation() throws Exception {
        mvc.perform(get("/api/work/community/chat/3/messages/search").param("q", "hi"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(chat);
        when(chat.search(actor, 3L, "hi")).thenReturn(java.util.List.of(java.util.Map.of(
            "id", 8, "sender_user_id", actor.userId(), "sender_name", "An Linh",
            "body", "Xin chào", "created_at", "2026-11-20T00:00:00Z", "has_image", false)));
        mvc.perform(get("/api/work/community/chat/3/messages/search").param("q", "hi")
                .header("Authorization", "Bearer valid"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(8))
            .andExpect(jsonPath("$.data[0].body").value("Xin chào"));
        verify(chat).search(actor, 3L, "hi");
    }

    @Test void includesReplyTargetWhenSendingAnImage() throws Exception {
        var file = new MockMultipartFile("file", "preview.png", "application/octet-stream", png());
        when(chat.sendImage(eq(actor), eq(3L), eq("caption"), eq(CLIENT_ID), any(), eq(7L))).thenReturn(11L);
        mvc.perform(multipart(MESSAGES).file(file).param("body", "caption").param("clientId", CLIENT_ID)
                .param("replyToMessageId", "7").header("Authorization", "Bearer valid"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data").value(11));
        verify(chat).sendImage(eq(actor), eq(3L), eq("caption"), eq(CLIENT_ID), any(), eq(7L));
    }

    @Test void loadsHistoryAroundASelectedSearchResult() throws Exception {
        when(chat.history(actor, 3L, null, 8L)).thenReturn(java.util.Map.of(
            "id", 3, "items", java.util.List.of(java.util.Map.of("id", 8))));
        mvc.perform(get("/api/work/community/chat/3").param("around", "8")
                .header("Authorization", "Bearer valid"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].id").value(8));
        verify(chat).history(actor, 3L, null, 8L);
    }

    private byte[] png() throws Exception {
        var buffer = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "PNG", buffer);
        return buffer.toByteArray();
    }
}
