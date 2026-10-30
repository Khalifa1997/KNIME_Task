package io.github.khalifa1997.texttransformer.core;

import java.util.List;
import java.util.Locale;

final class Uppercase implements Transformation {

    @Override
    public String id() {
        return "uppercase";
    }

    @Override
    public String label() {
        return "Uppercase";
    }

    @Override
    public String description() {
        return "Converts the text to upper case.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of();
    }

    @Override
    public String apply(String input, FieldValues values) {
        // Locale.ROOT, so the result never depends on the server's locale (the Turkish-i problem).
        return input.toUpperCase(Locale.ROOT);
    }
}
