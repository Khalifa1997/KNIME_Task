package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
class HttpProblemApiTest {
    @Autowired private MockMvcTester mvc;

    @Test
    void unknownRouteIsAFrameworkProblem() {
        assertThat(mvc.get().uri("/api/no-such-route"))
                .hasStatus(404).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson().extractingPath("$.status").isEqualTo(404);
    }

    @Test
    void wrongMethodIsAFrameworkProblem() {
        assertThat(mvc.get().uri("/api/chain/run"))
                .hasStatus(405).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson().extractingPath("$.status").isEqualTo(405);
    }

    @Test
    void unsupportedContentTypeIsAFrameworkProblem() {
        assertThat(mvc.post().uri("/api/chain/run").contentType(MediaType.TEXT_PLAIN).content("not json"))
                .hasStatus(415).hasContentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson().extractingPath("$.status").isEqualTo(415);
    }
}
