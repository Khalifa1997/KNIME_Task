package io.github.khalifa1997.texttransformer.core;

import java.util.List;

final class Replace implements Transformation {

    @Override
    public String id() {
        return "replace";
    }

    @Override
    public String label() {
        return "Replace";
    }

    @Override
    public String description() {
        return "Replaces every occurrence of some text with other text.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(
                FieldSpec.requiredText("search", "Search"),
                FieldSpec.text("replacement", "Replacement", ""));
    }

    @Override
    public String apply(String input, FieldValues values) {
        return input.replace(values.string("search"), values.string("replacement"));
    }
}
