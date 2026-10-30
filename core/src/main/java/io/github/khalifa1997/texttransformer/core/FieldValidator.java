package io.github.khalifa1997.texttransformer.core;

import java.math.BigInteger;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/** The first failing generic check for each Field, in declaration order. */
final class FieldValidator {

    record Validated(FieldValues values, List<FieldProblem> problems) {}

    static Validated validate(List<FieldSpec> fields, Map<String, Object> supplied) {
        var normalized = new LinkedHashMap<String, Object>();
        var problems = new ArrayList<FieldProblem>();
        for (var field : fields) {
            var value = supplied.get(field.name());
            if (field.required() && (value == null
                    || (field.type() == FieldSpec.Type.TEXT && "".equals(value)))) {
                problems.add(problem(field, ErrorCode.REQUIRED, " is required."));
                continue;
            }
            if (value == null) {
                value = field.defaultValue();
            }
            if (value == null) {
                continue;
            }
            if (field.type() == FieldSpec.Type.INTEGER) {
                value = integer(value);
            }
            boolean correctType = switch (field.type()) {
                case TEXT, SELECT -> value instanceof String;
                case INTEGER -> value instanceof Integer;
                case BOOLEAN -> value instanceof Boolean;
            };
            if (!correctType) {
                var wording = switch (field.type()) {
                    case TEXT, SELECT -> " must be text.";
                    case INTEGER -> " must be a whole number.";
                    case BOOLEAN -> " must be true or false.";
                };
                problems.add(problem(field, ErrorCode.WRONG_TYPE, wording));
            } else if (field.type() == FieldSpec.Type.INTEGER && field.min() != null
                    && (Integer) value < field.min()) {
                problems.add(problem(field, ErrorCode.BELOW_MIN,
                        " must be " + number(field.min()) + " or more."));
            } else if (field.type() == FieldSpec.Type.INTEGER && field.max() != null
                    && (Integer) value > field.max()) {
                problems.add(problem(field, ErrorCode.ABOVE_MAX,
                        " must be " + number(field.max()) + " or less."));
            } else if (field.type() == FieldSpec.Type.TEXT
                    && ((String) value).length() > Limits.DEFAULT.maxInputLength()) {
                problems.add(problem(field, ErrorCode.TOO_LONG,
                        " is longer than " + number(Limits.DEFAULT.maxInputLength()) + " characters."));
            } else if (field.type() == FieldSpec.Type.SELECT && !isChoice(field, (String) value)) {
                problems.add(problem(field, ErrorCode.NOT_A_CHOICE, " must be one of: "
                        + field.options().stream().map(FieldSpec.Choice::label)
                                .collect(Collectors.joining(", ")) + "."));
            } else {
                normalized.put(field.name(), value);
            }
        }
        return new Validated(FieldValues.of(fields, normalized), List.copyOf(problems));
    }

    private static FieldProblem problem(FieldSpec field, ErrorCode code, String suffix) {
        return new FieldProblem(field.name(), code, field.label() + suffix);
    }

    private static boolean isChoice(FieldSpec field, String value) {
        return field.options().stream().anyMatch(choice -> choice.value().equals(value));
    }

    // The public Integer accessor requires lossless int representation, before declared bounds.
    private static Integer integer(Object value) {
        if (value instanceof Byte || value instanceof Short || value instanceof Integer) {
            return ((Number) value).intValue();
        }
        if (value instanceof Long n && n >= Integer.MIN_VALUE && n <= Integer.MAX_VALUE) {
            return n.intValue();
        }
        if (value instanceof BigInteger n && n.compareTo(BigInteger.valueOf(Integer.MIN_VALUE)) >= 0
                && n.compareTo(BigInteger.valueOf(Integer.MAX_VALUE)) <= 0) {
            return n.intValue();
        }
        return null;
    }

    static String number(int value) {
        return NumberFormat.getIntegerInstance(Locale.US).format(value);
    }
}
