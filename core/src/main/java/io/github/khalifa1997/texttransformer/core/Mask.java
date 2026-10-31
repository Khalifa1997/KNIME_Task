package io.github.khalifa1997.texttransformer.core;

import java.util.List;

final class Mask implements Transformation {

    @Override
    public String id() {
        return "mask";
    }

    @Override
    public String label() {
        return "Mask";
    }

    @Override
    public String description() {
        return "Hides characters behind a mask character, optionally keeping some at the start or end.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(
                FieldSpec.text("character", "Mask character", "*"),
                FieldSpec.integer("keepStart", "Keep at start", false, 0, 0, null),
                FieldSpec.integer("keepEnd", "Keep at end", false, 0, 0, null));
    }

    @Override
    public List<FieldProblem> check(FieldValues values) {
        var character = values.string("character");
        if (character.codePointCount(0, character.length()) != 1) {
            return List.of(new FieldProblem("character", ErrorCode.NOT_ONE_CHARACTER,
                    "Mask character must be exactly one character."));
        }
        return List.of();
    }

    @Override
    public String apply(String input, FieldValues values) {
        // Code points, as Substring counts, so an emoji is masked as one character.
        int length = input.codePointCount(0, input.length());
        int keepStart = Math.min(values.integer("keepStart"), length);
        int keepEnd = Math.min(values.integer("keepEnd"), length - keepStart);
        int from = input.offsetByCodePoints(0, keepStart);
        int to = input.offsetByCodePoints(0, length - keepEnd);
        int masked = length - keepStart - keepEnd;
        return input.substring(0, from) + values.string("character").repeat(masked) + input.substring(to);
    }
}
