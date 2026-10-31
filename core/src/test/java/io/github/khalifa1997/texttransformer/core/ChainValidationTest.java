package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class ChainValidationTest {
    private static final FieldSpec START = FieldSpec.integer("start", "Start", true, null, 0, 2_000);
    private static final FieldSpec TEXT = FieldSpec.requiredText("text", "Custom label");
    private static final FieldSpec SELECT = FieldSpec.select("delimiter", "Delimiter", ",", List.of(
            new FieldSpec.Choice(",", "Comma"), new FieldSpec.Choice(";", "Semicolon")));

    private static final class Probe implements Transformation {
        private final List<FieldSpec> fields;
        private Function<FieldValues, List<FieldProblem>> checking = values -> List.of();
        private Function<FieldValues, String> applying = values -> "ok";
        private int checks;
        private int applies;
        private int metadataReads;

        Probe(FieldSpec... fields) { this.fields = List.of(fields); }
        public String id() { return "probe"; }
        public String label() { return "Probe"; }
        public String description() { return "Tests the public runner seam."; }
        public List<FieldSpec> fields() { metadataReads++; return fields; }
        public List<FieldProblem> check(FieldValues values) { checks++; return checking.apply(values); }
        public String apply(String input, FieldValues values) { applies++; return applying.apply(values); }
    }

    private static RunResult run(Probe probe, Map<String, Object> values) {
        return new ChainRunner(new TransformationRegistry(List.of(probe)))
                .run("", List.of(new StepInput("probe", values)));
    }

    private static void rejects(Probe probe, Map<String, Object> values, String field, ErrorCode code, String message) {
        assertThat(run(probe, values)).isEqualTo(new RunResult.Rejected(
                List.of(new StepError(0, field, code, message))));
        assertThat(probe.checks).isZero();
        assertThat(probe.applies).isZero();
        assertThat(probe.metadataReads).isEqualTo(1);
    }

    @Test
    void requiredWinsOverDefaultAndTypeAndEmptyTextIsMissing() {
        var requiredDefault = new FieldSpec("text", "Custom label", FieldSpec.Type.TEXT,
                true, "default", null, null, null);
        for (var values : List.<Map<String, Object>>of(Map.of(), Collections.singletonMap("text", null), Map.of("text", ""))) {
            rejects(new Probe(requiredDefault), values, "text", ErrorCode.REQUIRED, "Custom label is required.");
        }
        rejects(new Probe(START), Map.of(), "start", ErrorCode.REQUIRED, "Start is required.");
    }

    @Test
    void wrongTypeMessagesCoverEveryDeclaredType() {
        rejects(new Probe(TEXT), Map.of("text", 5), "text", ErrorCode.WRONG_TYPE, "Custom label must be text.");
        rejects(new Probe(START), Map.of("start", "5"), "start", ErrorCode.WRONG_TYPE, "Start must be a whole number.");
        rejects(new Probe(FieldSpec.bool("ignore", "Ignore case", false)), Map.of("ignore", "true"),
                "ignore", ErrorCode.WRONG_TYPE, "Ignore case must be true or false.");
        rejects(new Probe(SELECT), Map.of("delimiter", 1), "delimiter", ErrorCode.WRONG_TYPE, "Delimiter must be text.");
    }

    @Test
    void numericBoundsAreInclusiveAndUseUsThousandsSeparators() {
        rejects(new Probe(START), Map.of("start", -1), "start", ErrorCode.BELOW_MIN, "Start must be 0 or more.");
        rejects(new Probe(START), Map.of("start", 2_001), "start", ErrorCode.ABOVE_MAX, "Start must be 2,000 or less.");
        var field = FieldSpec.integer("start", "Start", true, null, 1_000, null);
        rejects(new Probe(field), Map.of("start", 999), "start", ErrorCode.BELOW_MIN, "Start must be 1,000 or more.");
        for (int n : List.of(0, 2_000)) {
            assertThat(run(new Probe(START), Map.of("start", n))).isInstanceOf(RunResult.Completed.class);
        }
    }

    static Stream<Object> acceptedIntegers() {
        return Stream.of((byte) 5, (short) 5, 5, 5L, BigInteger.valueOf(5),
                Integer.MIN_VALUE, Integer.MAX_VALUE, (long) Integer.MIN_VALUE, (long) Integer.MAX_VALUE,
                BigInteger.valueOf(Integer.MIN_VALUE), BigInteger.valueOf(Integer.MAX_VALUE));
    }

    @ParameterizedTest
    @MethodSource("acceptedIntegers")
    void integralRepresentationsAreNormalizedLosslessly(Object value) {
        var probe = new Probe(FieldSpec.integer("n", "Number", true, null, null, null));
        probe.checking = values -> {
            assertThat(values.integer("n")).isEqualTo(((Number) value).intValue());
            return List.of();
        };
        probe.applying = values -> values.integer("n").toString();
        assertThat(run(probe, Map.of("n", value))).isEqualTo(new RunResult.Completed(
                ((Number) value).intValue() + "", List.of(((Number) value).intValue() + "")));
    }

    static Stream<Object> rejectedIntegers() {
        return Stream.of("5", 5.0, 5.0f, new BigDecimal("5.0"),
                (long) Integer.MAX_VALUE + 1, (long) Integer.MIN_VALUE - 1,
                BigInteger.valueOf(Integer.MAX_VALUE).add(BigInteger.ONE),
                BigInteger.valueOf(Integer.MIN_VALUE).subtract(BigInteger.ONE), BigInteger.TEN.pow(100));
    }

    @ParameterizedTest
    @MethodSource("rejectedIntegers")
    void representationErrorsPrecedeDeclaredBounds(Object value) {
        rejects(new Probe(START), Map.of("start", value), "start", ErrorCode.WRONG_TYPE,
                "Start must be a whole number.");
        rejects(new Probe(FieldSpec.integer("start", "Start", true, null, null, null)),
                Map.of("start", value), "start", ErrorCode.WRONG_TYPE, "Start must be a whole number.");
    }

    @Test
    void textLengthIsUtf16AndExactlyThreeThousandIsValid() {
        var boundary = "😀".repeat(1_500);
        assertThat(run(new Probe(TEXT), Map.of("text", boundary))).isInstanceOf(RunResult.Completed.class);
        rejects(new Probe(TEXT), Map.of("text", boundary + "a"), "text", ErrorCode.TOO_LONG,
                "Custom label is longer than 3,000 characters.");
    }

    @Test
    void selectMembershipUsesValuesAndListsLabelsInDeclarationOrder() {
        rejects(new Probe(SELECT), Map.of("delimiter", "Comma"), "delimiter", ErrorCode.NOT_A_CHOICE,
                "Delimiter must be one of: Comma, Semicolon.");
        assertThat(run(new Probe(SELECT), Map.of("delimiter", ";"))).isInstanceOf(RunResult.Completed.class);
    }

    @Test
    void optionalNullsAndMissingValuesDefaultWhileWhitespaceAndUnknownKeysAreNotChanged() {
        var probe = new Probe(TEXT, FieldSpec.text("suffix", "Suffix", "!"),
                FieldSpec.integer("end", "End", false, null, 0, null),
                FieldSpec.bool("ignore", "Ignore case", true), SELECT);
        probe.checking = values -> {
            assertThat(values.string("text")).isEqualTo(" ");
            assertThat(values.string("suffix")).isEqualTo("!");
            assertThat(values.optionalInteger("end")).isNull();
            assertThat(values.bool("ignore")).isTrue();
            assertThat(values.choice("delimiter")).isEqualTo(",");
            assertThat(values.string("unknown")).isNull();
            return List.of();
        };
        var values = new HashMap<String, Object>();
        values.put("text", " ");
        values.put("suffix", null);
        values.put("end", null);
        values.put("delimiter", null);
        values.put("unknown", new Object());
        assertThat(run(probe, values)).isInstanceOf(RunResult.Completed.class);
        assertThat(probe.checks).isEqualTo(1);
        assertThat(probe.applies).isEqualTo(1);
    }

    @Test
    void allInputAndStepErrorsAreCollectedInOrderBeforeAnyApply() {
        var probe = new Probe(TEXT, START);
        var steps = new ArrayList<StepInput>();
        steps.add(new StepInput("probe", Map.of("text", "", "start", "5")));
        steps.add(new StepInput("missing", Map.of()));
        steps.add(new StepInput("probe", Map.of("text", "", "start", -1)));
        for (int i = 3; i < 31; i++) {
            steps.add(new StepInput("probe", Map.of("text", "valid", "start", 0)));
        }
        var result = new ChainRunner(new TransformationRegistry(List.of(probe))).run("a".repeat(3_001), steps);
        assertThat(result).isEqualTo(new RunResult.Rejected(List.of(
                new InputError(ErrorCode.INPUT_TOO_LONG, "Input text is longer than 3,000 characters."),
                new InputError(ErrorCode.TOO_MANY_STEPS, "A Chain can have at most 30 Steps."),
                new StepError(0, "text", ErrorCode.REQUIRED, "Custom label is required."),
                new StepError(0, "start", ErrorCode.WRONG_TYPE, "Start must be a whole number."),
                new StepError(1, null, ErrorCode.UNKNOWN_TRANSFORMATION, "Unknown Transformation \"missing\"."),
                new StepError(2, "text", ErrorCode.REQUIRED, "Custom label is required."),
                new StepError(2, "start", ErrorCode.BELOW_MIN, "Start must be 0 or more."))));
        assertThat(probe.checks).isEqualTo(28);
        assertThat(probe.applies).isZero();
    }

    @Test
    void semanticProblemsKeepTheirFieldNullabilityMessagesAndOrder() {
        var probe = new Probe(TEXT);
        probe.checking = values -> List.of(
                new FieldProblem(null, ErrorCode.START_AFTER_END, "Whole Step problem."),
                new FieldProblem("text", ErrorCode.INVALID_PATTERN, "First."),
                new FieldProblem("text", ErrorCode.PATTERN_TIMEOUT, "Second."));
        assertThat(run(probe, Map.of("text", "valid"))).isEqualTo(new RunResult.Rejected(List.of(
                new StepError(0, null, ErrorCode.START_AFTER_END, "Whole Step problem."),
                new StepError(0, "text", ErrorCode.INVALID_PATTERN, "First."),
                new StepError(0, "text", ErrorCode.PATTERN_TIMEOUT, "Second."))));
        assertThat(probe.applies).isZero();
    }

    @Test
    void inputOnlyRejectionStillChecksValidStepsButNeverApplies() {
        var probe = new Probe();
        var runner = new ChainRunner(new TransformationRegistry(List.of(probe)));
        assertThat(runner.run("😀".repeat(1_500) + "a", List.of(new StepInput("probe", Map.of()))))
                .isEqualTo(new RunResult.Rejected(List.of(new InputError(ErrorCode.INPUT_TOO_LONG,
                        "Input text is longer than 3,000 characters."))));
        assertThat(probe.checks).isEqualTo(1);
        assertThat(probe.applies).isZero();
    }

    @Test
    void exactlyThirtyStepsAndThreeThousandInputUnitsAreValidAndDefaultCheckIsEmpty() {
        var registry = TransformationRegistry.builtIn();
        assertThat(registry.find("uppercase").orElseThrow().check(FieldValues.of(List.of(), Map.of()))).isEmpty();
        var text = "😀".repeat(1_500);
        assertThat(new ChainRunner(registry).run(text,
                Collections.nCopies(30, new StepInput("uppercase", Map.of()))))
                .isEqualTo(new RunResult.Completed(text, Collections.nCopies(30, text)));
    }

    @Test
    void firstOverflowStopsAtNonFirstStepWithNoPartialResultsOrLaterApply() {
        var probe = new Probe();
        var registry = TransformationRegistry.builtIn();
        var all = new ArrayList<>(registry.all());
        all.add(probe);
        var runner = new ChainRunner(new TransformationRegistry(all));
        assertThat(runner.run("a", List.of(
                new StepInput("append", Map.of("text", "a".repeat(2_999))),
                new StepInput("append", Map.of("text", "b")),
                new StepInput("probe", Map.of()))))
                .isEqualTo(new RunResult.Rejected(List.of(new StepError(1, null, ErrorCode.RESULT_TOO_LONG,
                        "Result is longer than 3,000 characters."))));
        assertThat(probe.checks).isEqualTo(1);
        assertThat(probe.applies).isZero();
    }

    @Test
    void resultLengthUsesUtf16AndIncludesExpansionByAFieldlessTransformation() {
        var runner = new ChainRunner(TransformationRegistry.builtIn());
        assertThat(runner.run("😀".repeat(1_500), List.of(new StepInput("append", Map.of("text", "a")))))
                .isEqualTo(new RunResult.Rejected(List.of(new StepError(0, null, ErrorCode.RESULT_TOO_LONG,
                        "Result is longer than 3,000 characters."))));
        assertThat(runner.run("ß".repeat(1_501), List.of(new StepInput("uppercase", Map.of()))))
                .isEqualTo(new RunResult.Rejected(List.of(new StepError(0, null, ErrorCode.RESULT_TOO_LONG,
                        "Result is longer than 3,000 characters."))));
    }

    @Test
    void resultListsAreDefensiveAndUnmodifiable() {
        var errors = new ArrayList<RunError>();
        errors.add(new InputError(ErrorCode.TOO_MANY_STEPS, "message"));
        var rejected = new RunResult.Rejected(errors);
        errors.clear();
        assertThat(rejected.errors()).hasSize(1);
        assertThatThrownBy(() -> rejected.errors().clear()).isInstanceOf(UnsupportedOperationException.class);
        var outputs = new ArrayList<>(List.of("ok"));
        var completed = new RunResult.Completed("ok", outputs);
        outputs.clear();
        assertThat(completed.stepOutputs()).containsExactly("ok");
        assertThatThrownBy(() -> completed.stepOutputs().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(ErrorCode.values()).hasSize(15);
    }
}
