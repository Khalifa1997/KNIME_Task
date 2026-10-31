package io.github.khalifa1997.texttransformer.core;

import java.util.ArrayList;
import java.util.List;

/** Runs Input text through a Chain of Steps, each receiving the previous Step's result. */
public final class ChainRunner {

    private final TransformationRegistry registry;
    private final ContentChecker contentChecker;

    public ChainRunner(TransformationRegistry registry, ContentChecker contentChecker) {
        this.registry = registry;
        this.contentChecker = contentChecker;
    }

    public RunResult run(String inputText, List<StepInput> steps, boolean contentCheck) {
        var errors = new ArrayList<RunError>();
        var prepared = new ArrayList<PreparedStep>(steps.size());
        var limits = Limits.DEFAULT;
        if (inputText.length() > limits.maxInputLength()) {
            errors.add(new InputError(ErrorCode.INPUT_TOO_LONG,
                    "Input text is longer than " + FieldValidator.number(limits.maxInputLength()) + " characters."));
        }
        if (steps.size() > limits.maxSteps()) {
            errors.add(new InputError(ErrorCode.TOO_MANY_STEPS,
                    "A Chain can have at most " + FieldValidator.number(limits.maxSteps()) + " Steps."));
        }
        for (int index = 0; index < steps.size(); index++) {
            var step = steps.get(index);
            var found = registry.find(step.transformationId());
            if (found.isEmpty()) {
                errors.add(new StepError(index, null, ErrorCode.UNKNOWN_TRANSFORMATION,
                        "Unknown Transformation \"" + step.transformationId() + "\"."));
                continue;
            }
            var transformation = found.get();
            var validated = FieldValidator.validate(transformation.fields(), step.values());
            var problems = validated.problems().isEmpty()
                    ? transformation.check(validated.values()) : validated.problems();
            for (var problem : problems) {
                errors.add(new StepError(index, problem.field(), problem.code(), problem.message()));
            }
            prepared.add(new PreparedStep(transformation, validated.values()));
        }
        if (!errors.isEmpty()) {
            return new RunResult.Rejected(errors);
        }
        if (contentCheck && !inputText.isBlank() && contentChecker.flags(inputText)) {
            return new RunResult.Rejected(List.of(new InputError(ErrorCode.INPUT_FLAGGED,
                    "Input text was flagged as harmful and wasn't run.")));
        }

        var stepOutputs = new ArrayList<String>(steps.size());
        var text = inputText;
        for (int index = 0; index < prepared.size(); index++) {
            var step = prepared.get(index);
            try {
                text = step.transformation().apply(text, step.values());
            } catch (PatternTimeoutException e) {
                return new RunResult.Rejected(List.of(
                        new StepError(index, null, ErrorCode.PATTERN_TIMEOUT, e.getMessage())));
            } catch (ResultTooLongException e) {
                return resultTooLong(index, limits);
            }
            if (text.length() > limits.maxInputLength()) {
                return resultTooLong(index, limits);
            }
            stepOutputs.add(text);
        }
        return new RunResult.Completed(text, stepOutputs);
    }

    private static RunResult.Rejected resultTooLong(int index, Limits limits) {
        return new RunResult.Rejected(List.of(new StepError(index, null, ErrorCode.RESULT_TOO_LONG,
                "Result is longer than " + FieldValidator.number(limits.maxInputLength()) + " characters.")));
    }

    private record PreparedStep(Transformation transformation, FieldValues values) {}
}
