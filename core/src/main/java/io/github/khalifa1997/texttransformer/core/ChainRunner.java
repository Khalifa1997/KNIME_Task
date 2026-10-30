package io.github.khalifa1997.texttransformer.core;

import java.util.ArrayList;
import java.util.List;

/** Runs Input text through a Chain of Steps, each receiving the previous Step's result. */
public final class ChainRunner {

    private final TransformationRegistry registry;

    public ChainRunner(TransformationRegistry registry) {
        this.registry = registry;
    }

    public RunResult run(String inputText, List<StepInput> steps) {
        var stepOutputs = new ArrayList<String>(steps.size());
        var text = inputText;
        for (var step : steps) {
            var transformation = registry.find(step.transformationId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Unknown Transformation: " + step.transformationId()));
            text = transformation.apply(text, FieldValues.of(transformation.fields(), step.values()));
            stepOutputs.add(text);
        }
        return new RunResult.Completed(text, List.copyOf(stepOutputs));
    }
}
