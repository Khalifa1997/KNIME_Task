package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.khalifa1997.texttransformer.core.ContentCheckUnavailableException;
import io.github.khalifa1997.texttransformer.core.ContentChecker;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

/** The Content check over HTTP, with a fake checker standing in for the outside service. */
@SpringBootTest
@AutoConfigureMockMvc
class ContentCheckApiTest {

    static class FakeContentChecker implements ContentChecker {
        boolean flagEverything;
        boolean unreachable;
        int asked;

        @Override
        public boolean flags(String text) {
            asked++;
            if (unreachable) throw new ContentCheckUnavailableException("private detail");
            return flagEverything;
        }
    }

    @TestConfiguration
    static class Fakes {
        @Bean
        @Primary
        FakeContentChecker fakeContentChecker() {
            return new FakeContentChecker();
        }
    }

    @Autowired private MockMvcTester mvc;
    @Autowired private FakeContentChecker checker;

    @BeforeEach
    void resetTheFake() {
        checker.flagEverything = false;
        checker.unreachable = false;
        checker.asked = 0;
    }

    private static String contract(String name) throws IOException {
        return new ClassPathResource("contract/" + name).getContentAsString(StandardCharsets.UTF_8);
    }

    private MockMvcTester.MockMvcRequestBuilder runWithTheCheckOn() throws IOException {
        return mvc.post()
                .uri("/api/chain/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content(contract("post-chain-run.content-check.request.json"));
    }

    @Test
    void flaggedInputTextIsAnInputErrorAsInTheContract() throws IOException {
        checker.flagEverything = true;

        assertThat(runWithTheCheckOn())
                .hasStatus(422)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson()
                .isStrictlyEqualTo(new ClassPathResource("contract/post-chain-run.input-flagged.422.json"));
    }

    @Test
    void anUnreachableCheckIsARunFailureAsInTheContract() throws IOException {
        checker.unreachable = true;

        assertThat(runWithTheCheckOn())
                .hasStatus(503)
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson()
                .isStrictlyEqualTo(new ClassPathResource("contract/post-chain-run.check-unavailable.503.json"));
    }

    @Test
    void aRunWithoutTheContentCheckNeverAsksTheChecker() throws IOException {
        checker.flagEverything = true;

        assertThat(mvc.post()
                        .uri("/api/chain/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contract("post-chain-run.request.json")))
                .hasStatusOk();

        assertThat(checker.asked).isZero();
    }
}
