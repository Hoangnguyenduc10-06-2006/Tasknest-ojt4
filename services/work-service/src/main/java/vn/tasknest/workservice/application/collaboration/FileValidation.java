package vn.tasknest.workservice.application.collaboration;

import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.ZipInputStream;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import vn.tasknest.workservice.application.WorkException;

public final class FileValidation {
    private FileValidation() {}
    private static final Map<String,String> MIME=Map.of("png","image/png","jpg","image/jpeg","jpeg","image/jpeg","pdf","application/pdf","docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document","xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","pptx","application/vnd.openxmlformats-officedocument.presentationml.presentation","txt","text/plain","csv","text/csv","zip","application/zip");
    private static final java.util.concurrent.Semaphore DECODERS=new java.util.concurrent.Semaphore(1);
    public static String validate(String name,byte[] bytes,boolean imageOnly){
        if(!DECODERS.tryAcquire())throw new WorkException(HttpStatus.TOO_MANY_REQUESTS,"FILE_VALIDATOR_BUSY","Bộ kiểm tra tệp đang bận. Vui lòng thử tải lại.");
        try{return inspect(name,bytes,imageOnly);}finally{DECODERS.release();}
    }
    private static String inspect(String name,byte[] bytes,boolean imageOnly){
        if(name==null||name.isBlank()||name.length()>255||name.contains("/")||name.contains("\\")||name.chars().anyMatch(Character::isISOControl))throw invalid();
        String extension=name.substring(name.lastIndexOf('.')+1).toLowerCase(Locale.ROOT),mime=MIME.get(extension);
        if(mime==null||bytes.length==0||bytes.length>(imageOnly?5:20)*1024*1024||(imageOnly&&!mime.startsWith("image/")))throw invalid();
        try {
            if(mime.startsWith("image/")){
                try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
                    var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw invalid();var reader=readers.next();
                    try{reader.setInput(input);String format=reader.getFormatName();if(!(format.equalsIgnoreCase("png")&&extension.equals("png"))&&!(format.equalsIgnoreCase("jpeg")&&Set.of("jpg","jpeg").contains(extension)))throw invalid();
                        long pixels=(long)reader.getWidth(0)*reader.getHeight(0);if(pixels<=0||pixels>20000000||reader.read(0)==null)throw invalid();
                    }finally{reader.dispose();}
                }
            } else if(extension.equals("pdf")) {
                String head=new String(bytes,0,Math.min(bytes.length,8),StandardCharsets.US_ASCII);
                String tail=new String(bytes,Math.max(0,bytes.length-1024),Math.min(bytes.length,1024),StandardCharsets.US_ASCII);
                if(!head.startsWith("%PDF-")||!tail.contains("%%EOF"))throw invalid();
                try(var document=org.apache.pdfbox.Loader.loadPDF(bytes)){
                    if(document.isEncrypted()||document.getNumberOfPages()<1||document.getNumberOfPages()>5000)throw invalid();
                    var pending=new ArrayDeque<org.apache.pdfbox.cos.COSBase>();var visited=Collections.newSetFromMap(new IdentityHashMap<org.apache.pdfbox.cos.COSBase,Boolean>());
                    pending.add(document.getDocument().getTrailer());
                    Set<String> denied=Set.of("JavaScript","JS","Launch","EmbeddedFiles","EmbeddedFile","RichMedia","AA","OpenAction");
                    while(!pending.isEmpty()){
                        var node=pending.removeFirst();if(!visited.add(node))continue;if(visited.size()>100000)throw invalid();
                        if(node instanceof org.apache.pdfbox.cos.COSName nameValue && denied.contains(nameValue.getName()))throw invalid();
                        if(node instanceof org.apache.pdfbox.cos.COSObject object && object.getObject()!=null)pending.add(object.getObject());
                        if(node instanceof org.apache.pdfbox.cos.COSDictionary dictionary)for(var entry:dictionary.entrySet()){
                            if(denied.contains(entry.getKey().getName()))throw invalid();if(entry.getValue()!=null)pending.add(entry.getValue());
                        }
                        if(node instanceof org.apache.pdfbox.cos.COSArray array)for(var child:array)if(child!=null)pending.add(child);
                    }
                }
            } else if(Set.of("txt","csv").contains(extension)){
                String text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
                if(text.indexOf('\0')>=0||text.stripLeading().matches("(?is)^(<!doctype\\s+html|<html|<script|<svg|#!).*"))throw invalid();
            } else {
                if(bytes.length<4||bytes[0]!='P'||bytes[1]!='K')throw invalid();
                Set<String> names=new HashSet<>();Map<String,org.w3c.dom.Document> xml=new HashMap<>();long total=0;int count=0;
                try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))){java.util.zip.ZipEntry entry;byte[] buffer=new byte[8192];
                    while((entry=zip.getNextEntry())!=null){String path=entry.getName();if(++count>2000||path.startsWith("/")||path.contains("\\")||Arrays.asList(path.split("/")).contains("..")||path.toLowerCase(Locale.ROOT).contains("vbaproject")||!names.add(path))throw invalid();boolean officeXml=!extension.equals("zip")&&path.endsWith(".xml");ByteArrayOutputStream content=new ByteArrayOutputStream();int read;while((read=zip.read(buffer))!=-1){total+=read;if(total>80L*1024*1024)throw invalid();if(officeXml){if(content.size()+read>5*1024*1024)throw invalid();content.write(buffer,0,read);}}
                        if(!extension.equals("zip")&&(path.toLowerCase(Locale.ROOT).contains("activex/")||path.toLowerCase(Locale.ROOT).contains("embeddings/")))throw invalid();
                        if(officeXml){var parsed=parseXml(content.toByteArray());if(path.equals("[Content_Types].xml")||Set.of("word/document.xml","xl/workbook.xml","ppt/presentation.xml").contains(path))xml.put(path,parsed);}
}
                }
                if(count==0)throw invalid();
                if(!extension.equals("zip")&&(!names.contains("[Content_Types].xml")||!names.contains(switch(extension){case "docx"->"word/document.xml";case "xlsx"->"xl/workbook.xml";default->"ppt/presentation.xml";})))throw invalid();
                if(!extension.equals("zip")){
                    String main=switch(extension){case "docx"->"word/document.xml";case "xlsx"->"xl/workbook.xml";default->"ppt/presentation.xml";};
                    String expected=switch(extension){case "docx"->"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";case "xlsx"->"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";default->"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";};
                    var contentTypes=xml.get("[Content_Types].xml");var mainDocument=xml.get(main);if(contentTypes==null||mainDocument==null)throw invalid();
                    boolean declared=false;var nodes=contentTypes.getElementsByTagNameNS("http://schemas.openxmlformats.org/package/2006/content-types","Override");
                    for(int i=0;i<nodes.getLength();i++){var element=(org.w3c.dom.Element)nodes.item(i);String type=element.getAttribute("ContentType");if(type.toLowerCase(Locale.ROOT).contains("macroenabled")||type.toLowerCase(Locale.ROOT).contains("vba"))throw invalid();if(element.getAttribute("PartName").equals("/"+main)&&type.equals(expected))declared=true;}
                    String rootName=switch(extension){case "docx"->"document";case "xlsx"->"workbook";default->"presentation";};
                    if(!declared||!mainDocument.getDocumentElement().getLocalName().equals(rootName))throw invalid();
                }
            }
        }catch(IOException|IllegalArgumentException ex){throw invalid();}
        return mime;
    }
    private static org.w3c.dom.Document parseXml(byte[] content){
        try{var factory=javax.xml.parsers.DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);factory.setXIncludeAware(false);factory.setExpandEntityReferences(false);factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);factory.setFeature("http://xml.org/sax/features/external-general-entities",false);factory.setFeature("http://xml.org/sax/features/external-parameter-entities",false);factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD,"");factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");var builder=factory.newDocumentBuilder();builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler(){@Override public void fatalError(org.xml.sax.SAXParseException exception) throws org.xml.sax.SAXException{throw exception;}});return builder.parse(new ByteArrayInputStream(content));}catch(Exception exception){throw invalid();}
    }
    private static WorkException invalid(){return new WorkException(HttpStatus.BAD_REQUEST,"INVALID_FILE","Tệp không hợp lệ, sai định dạng hoặc vượt giới hạn dung lượng/kích thước.");}
}
