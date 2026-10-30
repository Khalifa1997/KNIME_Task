package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.ChainRunner;
import io.github.khalifa1997.texttransformer.core.InputError;
import io.github.khalifa1997.texttransformer.core.RunResult;
import io.github.khalifa1997.texttransformer.core.StepError;
import io.github.khalifa1997.texttransformer.core.StepInput;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
    ResponseEntity<?> run(@RequestBody RunRequest request) {
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
                yield ResponseEntity.ok(new RunResponse(completed.output(), stepResults));
            }
            case RunResult.Rejected rejected -> {
                var errors = rejected.errors().stream().map(error -> {
                    var code = error.code().name().toLowerCase(Locale.ROOT).replace('_', '-');
                    return switch (error) {
                        case InputError input -> new RunProblemError(null, null, code, input.message());
                        case StepError step -> new RunProblemError(
                                request.steps().get(step.stepIndex()).id(), step.field(), code, step.message());
                    };
                }).toList();
                var detail = errors.size() == 1
                        ? "1 problem stops the Chain from running."
                        : errors.size() + " problems stop the Chain from running.";
                yield ResponseEntity.unprocessableContent()
                        .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                        .body(new RunProblem("about:blank", 422, "Chain could not run", detail, errors));
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

    // Explicit envelope keeps the wire contract free of automatic ProblemDetail properties such as instance.
    record RunProblem(String type, int status, String title, String detail, List<RunProblemError> errors) {}

    record RunProblemError(String stepId, String field, String code, String detail) {}
}
