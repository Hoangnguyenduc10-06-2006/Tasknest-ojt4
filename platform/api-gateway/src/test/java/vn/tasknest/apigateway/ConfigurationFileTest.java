package vn.tasknest.apigateway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.FileSystemResource;
import static org.junit.jupiter.api.Assertions.*;
class ConfigurationFileTest {
    @Test void packagedApplicationYamlIsValidWithDistinctManagementServer() throws Exception {
        var source=new YamlPropertySourceLoader().load("application",new FileSystemResource("src/main/resources/application.yml")).getFirst();
        assertNotNull(source.getProperty("management.server.port"));
        assertEquals("none",source.getProperty("server.forward-headers-strategy"));
    }
}
