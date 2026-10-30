package io.github.khalifa1997.texttransformer.core;

import java.util.List;

final class Prepend implements Transformation {

    @Override
    public String id() {
        return "prepend";
    }

    @Override
    public String label() {
        return "Prepend";
    }

    @Override
    public String description() {
        return "Adds text to the start.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(FieldSpec.text("text", "Text", ""));
    }

    @Override
    public String apply(String input, FieldValues values) {
        return values.string("text") + input;
    }
}
