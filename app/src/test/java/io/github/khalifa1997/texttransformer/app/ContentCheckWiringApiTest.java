package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

/** How the server wires the Content check from the OPENAI_API_KEY setting. */
class ContentCheckWiringApiTest {

    @Nested
    @SpringBootTest(properties = "openai.api-key=")
    @AutoConfigureMockMvc
    class WithoutAnApiKey {
        @Autowired private MockMvcTester mvc;

        @Test
        void theMetadataSaysTheCheckIsUnavailable() {
            assertThat(mvc.get().uri("/api/transformations"))
                    .bodyJson()
                    .extractingPath("$.contentCheck.available")
                    .isEqualTo(false);
        }

        @Test
        void aRunThatAsksForTheCheckIsRefusedInsteadOfGoingThroughUnchecked() throws IOException {
            var request = new ClassPathResource("contract/post-chain-run.content-check.request.json")
                    .getContentAsString(StandardCharsets.UTF_8);

            assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.APPLICATION_JSON).content(request))
                    .hasStatus(503);
        }
    }

    @Nested
    @SpringBootTest(properties = "openai.api-key=sk-test")
    @AutoConfigureMockMvc
    class WithAnApiKey {
        @Autowired private MockMvcTester mvc;

        @Test
        void theMetadataSaysTheCheckIsAvailable() {
            assertThat(mvc.get().uri("/api/transformations"))
                    .bodyJson()
                    .extractingPath("$.contentCheck.available")
                    .isEqualTo(true);
        }
    }
}
