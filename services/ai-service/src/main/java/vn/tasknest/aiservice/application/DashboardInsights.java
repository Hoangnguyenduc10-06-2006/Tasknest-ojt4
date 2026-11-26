package vn.tasknest.aiservice.application;

import java.util.*;
import tools.jackson.databind.ObjectMapper;
import vn.tasknest.aiservice.infrastructure.work.TaskContext;

public record DashboardInsights(String overview, String attention, String awaiting, String review, Map<String,String> taskHints) {
    public static DashboardInsights parse(ObjectMapper json, String text, List<TaskContext.Source> sources) {
        try {
            var root = json.readTree(text);
            if (!root.isObject()) throw new IllegalArgumentException();
            var hints = new LinkedHashMap<String,String>();
            for (var source : sources) {
                String id = source.href().substring("/tasks/".length());
                var node = root.path("taskHints").path(id);
                if (node.isString()) hints.put(id, clean(node.asString(), 240));
            }
            return new DashboardInsights(field(root,"overview"), field(root,"attention"), field(root,"awaiting"), field(root,"review"), Map.copyOf(hints));
        } catch (RuntimeException ex) {
            // Safe fallback is plain text, never render raw structured output or untrusted links.
            return new DashboardInsights("", text.strip().startsWith("{") ? "" : clean(text,600), "", "", Map.of());
        }
    }
    private static String field(tools.jackson.databind.JsonNode node, String key) {
        var value = node.path(key);
        return value.isString() ? clean(value.asString(), 300) : "";
    }
    private static String clean(String text, int limit) {
        var value = text.replace("**", "").replace("`", "").strip();
        return value.substring(0, Math.min(value.length(),limit));
    }
}
