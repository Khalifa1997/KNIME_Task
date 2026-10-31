package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.ContentCheckUnavailableException;
import io.github.khalifa1997.texttransformer.core.ContentChecker;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** Screens Input text with OpenAI's Moderation API. */
final class OpenAiContentChecker implements ContentChecker {

    private static final String MODEL = "omni-moderation-latest";

    private final HttpClient client = HttpClient.newHttpClient();
    private final JsonMapper json = JsonMapper.builder().build();
    private final URI endpoint;
    private final String apiKey;
    private final Duration timeout;

    OpenAiContentChecker(URI baseUrl, String apiKey, Duration timeout) {
        this.endpoint = baseUrl.resolve("/v1/moderations");
        this.apiKey = apiKey;
        this.timeout = timeout;
    }

    @Override
    public boolean flags(String text) {
        try {
            var request = HttpRequest.newBuilder(endpoint)
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            json.writeValueAsString(new Request(MODEL, text))))
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new ContentCheckUnavailableException("OpenAI answered with status " + response.statusCode());
            }
            var flagged = json.readTree(response.body()).path("results").path(0).path("flagged");
            if (!flagged.isBoolean()) {
                throw new ContentCheckUnavailableException("OpenAI answered without a verdict");
            }
            return flagged.asBoolean();
        } catch (IOException | JacksonException e) {
            throw new ContentCheckUnavailableException("OpenAI could not be reached", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ContentCheckUnavailableException("The Content check was interrupted", e);
        }
    }

    private record Request(String model, String input) {}
}
