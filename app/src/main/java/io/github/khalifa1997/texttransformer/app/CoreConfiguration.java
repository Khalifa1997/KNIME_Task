package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.Limits;
import io.github.khalifa1997.texttransformer.core.TransformationRegistry;
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
    Limits limits() {
        return Limits.DEFAULT;
    }
}
