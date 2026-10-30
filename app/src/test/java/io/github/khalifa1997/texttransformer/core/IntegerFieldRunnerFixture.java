package io.github.khalifa1997.texttransformer.core;

import java.util.List;

/** Test-only registry access: exercises real integer validation without adding a built-in. */
public final class IntegerFieldRunnerFixture {
    private IntegerFieldRunnerFixture() {}

    public static ChainRunner runner() {
        var transformation = new Transformation() {
            public String id() { return "integer-probe"; }
            public String label() { return "Integer probe"; }
            public String description() { return "Exercises the integer Field HTTP boundary."; }
            public List<FieldSpec> fields() {
                return List.of(FieldSpec.integer("start", "Start", true, null, 0, null));
            }
            public String apply(String input, FieldValues values) {
                return input + values.integer("start");
            }
        };
        return new ChainRunner(new TransformationRegistry(List.of(transformation)));
    }
}
