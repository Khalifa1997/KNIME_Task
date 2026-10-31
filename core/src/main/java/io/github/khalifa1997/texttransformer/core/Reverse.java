package io.github.khalifa1997.texttransformer.core;

import java.util.List;
import java.util.regex.Pattern;

final class Reverse implements Transformation {

    // \X is one grapheme cluster: what a reader sees as one character, such as an accented letter or a flag.
    private static final Pattern GRAPHEME = Pattern.compile("\\X");

    @Override
    public String id() {
        return "reverse";
    }

    @Override
    public String label() {
        return "Reverse";
    }

    @Override
    public String description() {
        return "Reverses the order of the characters.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of();
    }

    @Override
    public String apply(String input, FieldValues values) {
        var graphemes = GRAPHEME.matcher(input).results().map(match -> match.group()).toList();
        var result = new StringBuilder(input.length());
        for (int i = graphemes.size() - 1; i >= 0; i--) {
            result.append(graphemes.get(i));
        }
        return result.toString();
    }
}
