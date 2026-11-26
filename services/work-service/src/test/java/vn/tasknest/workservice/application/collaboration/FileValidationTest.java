package vn.tasknest.workservice.application.collaboration;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import org.junit.jupiter.api.Test;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.cos.*;
import vn.tasknest.workservice.application.WorkException;
import static org.junit.jupiter.api.Assertions.*;
class FileValidationTest {
    @Test void validatesPdfStructureAndRejectsExecutableActions() throws Exception {
        try(var pdf=new PDDocument();var bytes=new ByteArrayOutputStream()){
            pdf.addPage(new PDPage());pdf.save(bytes);
            assertEquals("application/pdf",FileValidation.validate("plain.pdf",bytes.toByteArray(),false));
            var action=new COSDictionary();action.setItem(COSName.S,COSName.getPDFName("JavaScript"));action.setString(COSName.getPDFName("JS"),"app.alert('test')");pdf.getDocumentCatalog().getCOSObject().setItem(COSName.getPDFName("OpenAction"),action);bytes.reset();pdf.save(bytes);
            assertThrows(WorkException.class,()->FileValidation.validate("active.pdf",bytes.toByteArray(),false));
        }
        assertThrows(WorkException.class,()->FileValidation.validate("fake.pdf","%PDF-1.7\nnot a document\n%%EOF".getBytes(StandardCharsets.US_ASCII),false));
    }
    @Test void validatesOfficeXmlAndDisablesExternalEntityResolution() throws Exception {
        String types="<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'><Override PartName='/word/document.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'/></Types>";
        String document="<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body/></w:document>";
        assertEquals("application/vnd.openxmlformats-officedocument.wordprocessingml.document",FileValidation.validate("report.docx",office(types,document),false));
        assertThrows(WorkException.class,()->FileValidation.validate("fake.docx",office(types,"not XML"),false));
        assertThrows(WorkException.class,()->FileValidation.validate("entity.docx",office(types,"<!DOCTYPE document [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>"+document),false));
        assertThrows(WorkException.class,()->FileValidation.validate("macro.docx",office(types.replace("document.main+xml","document.macroEnabled.main+xml"),document),false));
    }
    @Test void rejectsScriptDisguisedAsTextAndTraversalArchives() throws Exception {
        assertThrows(WorkException.class,()->FileValidation.validate("payload.txt","<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8),false));
        assertThrows(WorkException.class,()->FileValidation.validate("payload.svg","<svg/>".getBytes(StandardCharsets.UTF_8),true));
        try(var bytes=new ByteArrayOutputStream();var zip=new ZipOutputStream(bytes)){
            zip.putNextEntry(new ZipEntry("../escape.txt"));zip.write("data".getBytes(StandardCharsets.UTF_8));zip.closeEntry();zip.finish();
            assertThrows(WorkException.class,()->FileValidation.validate("traversal.zip",bytes.toByteArray(),false));
        }
    }
    private byte[] office(String types,String document) throws IOException {
        var bytes=new ByteArrayOutputStream();try(var zip=new ZipOutputStream(bytes)){
            zip.putNextEntry(new ZipEntry("[Content_Types].xml"));zip.write(types.getBytes(StandardCharsets.UTF_8));zip.closeEntry();
            zip.putNextEntry(new ZipEntry("word/document.xml"));zip.write(document.getBytes(StandardCharsets.UTF_8));zip.closeEntry();
        }return bytes.toByteArray();
    }
}
