package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.ChainRunner;
import io.github.khalifa1997.texttransformer.core.ContentChecker;
import io.github.khalifa1997.texttransformer.core.Limits;
import io.github.khalifa1997.texttransformer.core.TransformationRegistry;
import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Exposes the Spring-free core library as beans. */
@Configuration(proxyBeanMethods = false)
class CoreConfiguration {

    @Bean
    TransformationRegistry transformationRegistry() {
        return TransformationRegistry.builtIn();
    }

    @Bean
    ChainRunner chainRunner(TransformationRegistry registry, ContentChecker contentChecker) {
        return new ChainRunner(registry, contentChecker);
    }

    @Bean
    ContentChecker contentChecker(
            @Value("${openai.api-key:}") String apiKey,
            @Value("${openai.base-url:https://api.openai.com}") String baseUrl,
            @Value("${openai.timeout:5s}") Duration timeout) {
        if (apiKey.isBlank()) return new UnavailableContentChecker();
        return new OpenAiContentChecker(URI.create(baseUrl), apiKey, timeout);
    }

    @Bean
    ContentCheckAvailability contentCheckAvailability(ContentChecker contentChecker) {
        return new ContentCheckAvailability(!(contentChecker instanceof UnavailableContentChecker));
    }

    @Bean
    Limits limits() {
        return Limits.DEFAULT;
    }
}
