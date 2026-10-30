package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import io.github.khalifa1997.texttransformer.core.ChainRunner;
import io.github.khalifa1997.texttransformer.core.RunResult;
import io.github.khalifa1997.texttransformer.core.StepInput;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

/** Injects failures only in tests; normal shape and success tests retain the real core. */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class RunBoundaryApiTest {
    @Autowired private MockMvcTester mvc;
    @MockitoBean private ChainRunner runner;

    @Test
    void unexpectedFailureIsGenericAndTheRealExceptionIsLogged(CapturedOutput output) {
        when(runner.run(anyString(), any())).thenThrow(new IllegalStateException("injected private failure"));
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON)
                .content("{\"inputText\":\"\",\"steps\":[]}"))
                .hasStatus(500).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson().isStrictlyEqualTo(new ClassPathResource("contract/post-chain-run.500.json"));
        assertThat(output.getAll()).contains("Unexpected HTTP request failure", "java.lang.IllegalStateException: injected private failure");
    }

    @Test
    void contentLimitsAreLeftToCore() {
        var input = "a".repeat(3001);
        var fieldText = "b".repeat(3001);
        when(runner.run(anyString(), any())).thenAnswer(invocation -> {
            assertThat((String) invocation.getArgument(0)).isEqualTo(input);
            List<StepInput> steps = invocation.getArgument(1);
            assertThat(steps).hasSize(31);
            assertThat(steps.getFirst().values().get("text")).isEqualTo(fieldText);
            return new RunResult.Completed(input, java.util.Collections.nCopies(31, input));
        });
        var steps = java.util.stream.IntStream.range(0, 31)
                .mapToObj(index -> "{\"id\":\"s" + index
                        + "\",\"transformationId\":\"uppercase\",\"values\":{\"text\":\"" + fieldText + "\"}}")
                .collect(java.util.stream.Collectors.joining(","));
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON)
                .content("{\"inputText\":\"" + input + "\",\"steps\":[" + steps + "]}"))
                .hasStatusOk();
    }

    @Test
    void shapeBoundaryPreservesRawFieldValuesForCore() {
        when(runner.run(anyString(), any())).thenAnswer(invocation -> {
            List<StepInput> steps = invocation.getArgument(1);
            var values = steps.getFirst().values();
            assertThat(values.get("integer")).isEqualTo(5);
            assertThat(values.get("decimal")).isEqualTo(5.0);
            assertThat(values.get("string")).isEqualTo("5");
            assertThat(values).containsEntry("nullable", null).containsEntry("boolean", true);
            assertThat(values.get("array")).isEqualTo(List.of(1, "2"));
            assertThat(values.get("object")).isEqualTo(java.util.Map.of("nested", false));
            return new RunResult.Completed("ok", List.of("ok"));
        });
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON).content("""
                {"inputText":"text","steps":[{"id":"s","transformationId":"substring","values":{
                    "integer":5,"decimal":5.0,"string":"5","nullable":null,"boolean":true,
                    "array":[1,"2"],"object":{"nested":false}
                }}]}
                """))
                .hasStatusOk().bodyJson().isStrictlyEqualTo("{\"output\":\"ok\",\"steps\":[{\"id\":\"s\",\"output\":\"ok\"}]}");
    }
}
