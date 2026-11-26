package vn.tasknest.aiservice.application;



public interface AiProvider {
    Answer complete(String prompt);
    record Answer(String text, String model, int inputTokens, int outputTokens) {}
}
