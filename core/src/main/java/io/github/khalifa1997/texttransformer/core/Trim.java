package io.github.khalifa1997.texttransformer.core;

import java.util.List;

final class Trim implements Transformation {

    @Override
    public String id() {
        return "trim";
    }

    @Override
    public String label() {
        return "Trim whitespace";
    }

    @Override
    public String description() {
        return "Removes spaces, tabs and line breaks from the start, the end, or both.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(FieldSpec.select("sides", "Trim from", "both", List.of(
                new FieldSpec.Choice("both", "Both ends"),
                new FieldSpec.Choice("start", "Start"),
                new FieldSpec.Choice("end", "End"))));
    }

    @Override
    public String apply(String input, FieldValues values) {
        // strip, not trim: Unicode whitespace too, but never control characters such as NUL.
        return switch (values.choice("sides")) {
            case "start" -> input.stripLeading();
            case "end" -> input.stripTrailing();
            default -> input.strip();
        };
    }
}
