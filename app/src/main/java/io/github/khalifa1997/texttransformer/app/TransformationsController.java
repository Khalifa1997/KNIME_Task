package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.FieldSpec;
import io.github.khalifa1997.texttransformer.core.Limits;
import io.github.khalifa1997.texttransformer.core.Transformation;
import io.github.khalifa1997.texttransformer.core.TransformationRegistry;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** The metadata the frontend builds its palette and Fields from. */
@RestController
class TransformationsController {

    private final TransformationRegistry registry;
    private final Limits limits;

    TransformationsController(TransformationRegistry registry, Limits limits) {
        this.registry = registry;
        this.limits = limits;
    }

    @GetMapping("/api/transformations")
    Metadata transformations() {
        return new Metadata(limits, registry.all().stream().map(TransformationJson::of).toList());
    }

    record Metadata(Limits limits, List<TransformationJson> transformations) {}

    record TransformationJson(String id, String label, String description, List<FieldJson> fields) {

        static TransformationJson of(Transformation t) {
            return new TransformationJson(
                    t.id(), t.label(), t.description(), t.fields().stream().map(FieldJson::of).toList());
        }
    }

    record FieldJson(
            String name,
            String label,
            String type,
            boolean required,
            Object defaultValue,
            Integer min,
            Integer max,
            List<FieldSpec.Choice> options) {

        static FieldJson of(FieldSpec f) {
            return new FieldJson(
                    f.name(),
                    f.label(),
                    f.type().name().toLowerCase(Locale.ROOT),
                    f.required(),
                    f.defaultValue(),
                    f.min(),
                    f.max(),
                    f.options());
        }
    }
}
