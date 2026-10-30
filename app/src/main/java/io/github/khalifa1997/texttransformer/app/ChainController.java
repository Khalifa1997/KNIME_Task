package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.ChainRunner;
import io.github.khalifa1997.texttransformer.core.RunResult;
import io.github.khalifa1997.texttransformer.core.StepInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.annotation.JsonDeserialize;

/** Runs a Chain of Steps over some Input text. */
@RestController
class ChainController {

    private final ChainRunner runner;

    ChainController(ChainRunner runner) {
        this.runner = runner;
    }

    @PostMapping("/api/chain/run")
    RunResponse run(@Valid @RequestBody RunRequest request) {
        var steps = request.steps().stream()
                .map(step -> new StepInput(step.transformationId(), step.values()))
                .toList();
        return switch (runner.run(request.inputText(), steps)) {
            case RunResult.Completed completed -> {
                var stepResults = new ArrayList<StepResult>(steps.size());
                for (int i = 0; i < steps.size(); i++) {
                    stepResults.add(
                            new StepResult(request.steps().get(i).id(), completed.stepOutputs().get(i)));
                }
                yield new RunResponse(completed.output(), stepResults);
            }
        };
    }

    record RunRequest(
            @NotNull @JsonDeserialize(using = RequestStringDeserializer.class) String inputText,
            @NotNull @UniqueStepIds List<@NotNull @Valid StepJson> steps) {}

    record StepJson(
            @NotBlank @Size(max = 64) @JsonDeserialize(using = RequestStringDeserializer.class) String id,
            @NotBlank @JsonDeserialize(using = RequestStringDeserializer.class) String transformationId,
            @JsonDeserialize(using = FieldValuesDeserializer.class) Map<String, Object> values) {}

    record RunResponse(String output, List<StepResult> steps) {}

    record StepResult(String id, String output) {}
}
