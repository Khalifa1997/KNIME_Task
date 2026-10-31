package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import io.github.khalifa1997.texttransformer.core.ContentCheckUnavailableException;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** The OpenAI adapter against a stub server standing in for api.openai.com. */
class OpenAiContentCheckerTest {

    private final HttpServer server = start();
    private final AtomicReference<String> path = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();

    private static HttpServer start() {
        try {
            var created = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            created.start();
            return created;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private void reply(int status, String json) {
        server.createContext("/", exchange -> {
            path.set(exchange.getRequestURI().getPath());
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            var bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
    }

    private OpenAiContentChecker checker() {
        return new OpenAiContentChecker(
                URI.create("http://127.0.0.1:" + server.getAddress().getPort()), "sk-test", Duration.ofSeconds(2));
    }

    @Test
    void asksTheModerationEndpointAndReportsAFlaggedVerdict() {
        reply(200, "{\"results\":[{\"flagged\":true}]}");

        assertThat(checker().flags("some \"quoted\" text")).isTrue();

        assertThat(path.get()).isEqualTo("/v1/moderations");
        assertThat(authorization.get()).isEqualTo("Bearer sk-test");
        assertThat(body.get()).isEqualTo("{\"model\":\"omni-moderation-latest\",\"input\":\"some \\\"quoted\\\" text\"}");
    }

    @Test
    void reportsAnUnflaggedVerdict() {
        reply(200, "{\"results\":[{\"flagged\":false}]}");

        assertThat(checker().flags("hello")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(ints = {401, 429, 500, 503})
    void anErrorStatusIsUnavailableNeverAPass(int status) {
        reply(status, "{\"error\":{\"message\":\"nope\"}}");

        assertThatThrownBy(() -> checker().flags("hello")).isInstanceOf(ContentCheckUnavailableException.class);
    }

    @Test
    void anAnswerWithoutAVerdictIsUnavailableNeverAPass() {
        reply(200, "{\"results\":[]}");

        assertThatThrownBy(() -> checker().flags("hello")).isInstanceOf(ContentCheckUnavailableException.class);
    }

    @Test
    void aBodyThatIsNotJsonIsUnavailable() {
        reply(200, "<html>gateway</html>");

        assertThatThrownBy(() -> checker().flags("hello")).isInstanceOf(ContentCheckUnavailableException.class);
    }

    @Test
    void aSlowServerIsUnavailable() {
        server.createContext("/", exchange -> {
            try {
                Thread.sleep(1_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            exchange.close();
        });
        var impatient = new OpenAiContentChecker(
                URI.create("http://127.0.0.1:" + server.getAddress().getPort()), "sk-test", Duration.ofMillis(100));

        assertThatThrownBy(() -> impatient.flags("hello")).isInstanceOf(ContentCheckUnavailableException.class);
    }

    @Test
    void aServerThatIsNotListeningIsUnavailable() {
        server.stop(0);

        assertThatThrownBy(() -> checker().flags("hello")).isInstanceOf(ContentCheckUnavailableException.class);
    }
}
