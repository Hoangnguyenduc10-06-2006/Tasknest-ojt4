package vn.tasknest.workservice.api;
import java.util.*;
import java.time.*;
/** MySQL DATETIME values represent UTC throughout this application. */
public final class ApiValues {
    private ApiValues(){}
    public static List<Map<String,Object>> utc(List<Map<String,Object>> rows){
        for(var row:rows)row.replaceAll((key,value)->{
            if(value instanceof java.sql.Timestamp timestamp)return timestamp.toInstant();
            if(value instanceof LocalDateTime timestamp)return timestamp.toInstant(ZoneOffset.UTC);
            if(value instanceof java.sql.Date date)return date.toLocalDate();
            return value;
        });return rows;
    }
}
