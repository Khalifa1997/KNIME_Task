package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.ChainRunner;
import io.github.khalifa1997.texttransformer.core.RunResult;
import io.github.khalifa1997.texttransformer.core.StepInput;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Runs a Chain of Steps over some Input text. */
@RestController
class ChainController {

    private final ChainRunner runner;

    ChainController(ChainRunner runner) {
        this.runner = runner;
    }

    @PostMapping("/api/chain/run")
    RunResponse run(@RequestBody RunRequest request) {
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

    record RunRequest(String inputText, List<StepJson> steps) {}

    record StepJson(String id, String transformationId, Map<String, Object> values) {

        StepJson {
            values = values == null ? Map.of() : values;
        }
    }

    record RunResponse(String output, List<StepResult> steps) {}

    record StepResult(String id, String output) {}
}
