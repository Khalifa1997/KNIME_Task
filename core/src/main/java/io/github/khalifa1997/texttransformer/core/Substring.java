package io.github.khalifa1997.texttransformer.core;

import java.util.List;

final class Substring implements Transformation {

    @Override
    public String id() {
        return "substring";
    }

    @Override
    public String label() {
        return "Substring";
    }

    @Override
    public String description() {
        return "Keeps only part of the text, counted in characters from 0.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(
                FieldSpec.integer("start", "Start", true, 0, 0, null),
                FieldSpec.integer("end", "End", false, null, 0, null));
    }

    @Override
    public List<FieldProblem> check(FieldValues values) {
        var end = values.optionalInteger("end");
        if (end != null && values.integer("start") > end) {
            return List.of(new FieldProblem("end", ErrorCode.START_AFTER_END, "End must not be before Start."));
        }
        return List.of();
    }

    @Override
    public String apply(String input, FieldValues values) {
        int length = input.codePointCount(0, input.length());
        var end = values.optionalInteger("end");
        int startPoint = Math.min(values.integer("start"), length);
        int endPoint = end == null ? length : Math.min(end, length);
        if (startPoint >= endPoint) {
            return "";
        }
        int from = input.offsetByCodePoints(0, startPoint);
        int to = input.offsetByCodePoints(from, endPoint - startPoint);
        return input.substring(from, to);
    }
}
