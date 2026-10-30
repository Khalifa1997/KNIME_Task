package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.khalifa1997.texttransformer.core.ChainRunner;
import io.github.khalifa1997.texttransformer.core.IntegerFieldRunnerFixture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
@Import(IntegerFieldRunApiTest.IntegerFieldConfiguration.class)
class IntegerFieldRunApiTest {
    @Autowired private MockMvcTester mvc;

    @TestConfiguration(proxyBeanMethods = false)
    static class IntegerFieldConfiguration {
        @Bean
        @Primary
        ChainRunner integerFieldRunner() {
            return IntegerFieldRunnerFixture.runner();
        }
    }

    @Test
    void jsonIntegerReachesAndExecutesTheRealCore() {
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON).content(request("5")))
                .hasStatusOk().bodyJson().isStrictlyEqualTo("""
                        {"output":"input5","steps":[{"id":"stable-step","output":"input5"}]}
                        """);
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"5\"", "5.0"})
    void numericStringAndDecimalAreCoreWrongTypeNotShapeOrServerFailures(String value) {
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON).content(request(value)))
                .hasStatus(422).hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson().isStrictlyEqualTo("""
                        {"type":"about:blank","status":422,"title":"Chain could not run",
                         "detail":"1 problem stops the Chain from running.",
                         "errors":[{"stepId":"stable-step","field":"start","code":"wrong-type",
                                    "detail":"Start must be a whole number."}]}
                        """);
    }

    private static String request(String value) {
        return """
                {"inputText":"input","steps":[{"id":"stable-step","transformationId":"integer-probe",
                 "values":{"start":%s}}]}
                """.formatted(value);
    }
}
