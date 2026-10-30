package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
class RunRequestShapeApiTest {
    @Autowired private MockMvcTester mvc;

    static Stream<Arguments> invalidRequests() {
        var cases = Stream.<Arguments>builder();
        for (var body : new String[] {"", "not json", "{", "{\"inputText\":", "null", "42", "true", "\"text\"", "[]"}) {
            cases.add(Arguments.of(body, "Request body is not valid JSON."));
        }
        cases.add(Arguments.of("{\"steps\":[]}", "Invalid value at inputText."));
        for (var value : new String[] {"null", "1", "true", "{}", "[]"}) {
            cases.add(Arguments.of("{\"inputText\":" + value + ",\"steps\":[]}", "Invalid value at inputText."));
        }
        cases.add(Arguments.of("{\"inputText\":\"\"}", "Invalid value at steps."));
        for (var value : new String[] {"null", "1", "true", "{}", "\"text\""}) {
            cases.add(Arguments.of("{\"inputText\":\"\",\"steps\":" + value + "}", "Invalid value at steps."));
        }
        for (var value : new String[] {"null", "1", "true", "[]", "\"text\""}) {
            cases.add(Arguments.of(request(value), "Invalid value at steps[0]."));
        }
        for (var property : new String[] {"id", "transformationId"}) {
            var other = property.equals("id") ? "transformationId" : "id";
            cases.add(Arguments.of(request("{\"" + other + "\":\"uppercase\"}"), "Invalid value at steps[0]." + property + "."));
            for (var value : new String[] {"null", "1", "true", "{}", "[]", "\"\"", "\"  \""}) {
                cases.add(Arguments.of(request("{\"" + other + "\":\"uppercase\",\"" + property + "\":" + value + "}"),
                        "Invalid value at steps[0]." + property + "."));
            }
        }
        cases.add(Arguments.of(request(step("a".repeat(65), "{}")), "Invalid value at steps[0].id."));
        for (var value : new String[] {"null", "1", "true", "[]", "\"text\""}) {
            cases.add(Arguments.of(request(step("s", value)), "Invalid value at steps[0].values."));
        }
        cases.add(Arguments.of(request(step("same", "{}") + "," + step("same", "{}")), "Step ids must be unique."));
        return cases.build();
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void rejectsOnlyMalformedShapeWithSafePaths(String body, String detail) {
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON).content(body))
                .hasStatus(400).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson().isStrictlyEqualTo("""
                        {"title":"Bad Request","status":400,"detail":"%s","instance":"/api/chain/run"}
                        """.formatted(detail));
    }

    @Test
    void duplicateIdsMatchSharedProblemFixture() {
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON)
                .content(request(step("s", "{}") + "," + step("s", "{}"))))
                .hasStatus(400).bodyJson()
                .isStrictlyEqualTo(new ClassPathResource("contract/post-chain-run.duplicate-ids.400.json"));
    }

    @Test
    void acceptsEmptyInputAndChain() {
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON)
                .content("{\"inputText\":\"\",\"steps\":[]}"))
                .hasStatusOk().bodyJson().isStrictlyEqualTo("{\"output\":\"\",\"steps\":[]}");
    }

    @Test
    void missingValuesMeansEmptyObjectAndIdsNeedNotBeUuids() {
        for (var id : new String[] {"not a UUID", "a".repeat(64)}) {
            assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON)
                    .content(request("{\"id\":\"" + id + "\",\"transformationId\":\"uppercase\"}")))
                    .hasStatusOk().bodyJson().isStrictlyEqualTo(
                            "{\"output\":\"TEXT\",\"steps\":[{\"id\":\"" + id + "\",\"output\":\"TEXT\"}]}");
        }
    }

    @Test
    void selectsMultipleConstraintFailuresDeterministically() {
        for (int i = 0; i < 5; i++) {
            assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"inputText\":null,\"steps\":[{}]}"))
                    .hasStatus(400).bodyJson().extractingPath("$.detail").isEqualTo("Invalid value at inputText.");
        }
    }

    private static String request(String steps) {
        return "{\"inputText\":\"text\",\"steps\":[" + steps + "]}";
    }

    private static String step(String id, String values) {
        return "{\"id\":\"" + id + "\",\"transformationId\":\"uppercase\",\"values\":" + values + "}";
    }
}
