package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
class ChainRunApiTest {

    @Autowired
    private MockMvcTester mvc;

    private static String contract(String name) throws IOException {
        return new ClassPathResource("contract/" + name).getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    void runsTheStepsInChainOrderAsInTheContract() throws IOException {
        assertThat(mvc.post()
                        .uri("/api/chain/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contract("post-chain-run.request.json")))
                .hasStatusOk()
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .bodyJson()
                .isStrictlyEqualTo(new ClassPathResource("contract/post-chain-run.200.json"));
    }

    @Test
    void anEmptyChainReturnsTheInputTextAsTheOutput() throws IOException {
        assertThat(mvc.post()
                        .uri("/api/chain/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(contract("post-chain-run.empty.request.json")))
                .hasStatusOk()
                .bodyJson()
                .isStrictlyEqualTo(new ClassPathResource("contract/post-chain-run.empty.200.json"));
    }
}
