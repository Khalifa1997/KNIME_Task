package io.github.khalifa1997.texttransformer.core;

import java.util.List;

final class Append implements Transformation {

    @Override
    public String id() {
        return "append";
    }

    @Override
    public String label() {
        return "Append";
    }

    @Override
    public String description() {
        return "Adds text to the end.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(FieldSpec.text("text", "Text", ""));
    }

    @Override
    public String apply(String input, FieldValues values) {
        return input + values.string("text");
    }
}
