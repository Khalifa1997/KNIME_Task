package io.github.khalifa1997.texttransformer.core;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

final class RegexReplace implements Transformation {

    private static final long DEADLINE_NANOS = TimeUnit.SECONDS.toNanos(2);

    @Override
    public String id() {
        return "regex";
    }

    @Override
    public String label() {
        return "Regex replace";
    }

    @Override
    public String description() {
        return "Replaces every match of a regular expression.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(
                FieldSpec.requiredText("pattern", "Pattern"),
                FieldSpec.text("replacement", "Replacement", ""),
                FieldSpec.bool("ignoreCase", "Ignore case", false));
    }

    @Override
    public List<FieldProblem> check(FieldValues values) {
        Pattern pattern;
        try {
            pattern = compile(values);
        } catch (PatternSyntaxException e) {
            return List.of(new FieldProblem("pattern", ErrorCode.INVALID_PATTERN, e.getDescription()));
        }
        try {
            parse(values.string("replacement"), pattern);
            return List.of();
        } catch (IllegalArgumentException e) {
            return List.of(new FieldProblem("replacement", ErrorCode.INVALID_PATTERN, e.getMessage()));
        }
    }

    @Override
    public String apply(String input, FieldValues values) {
        var pattern = compile(values);
        var parts = parse(values.string("replacement"), pattern);
        var matcher = pattern.matcher(new DeadlineCharSequence(input, System.nanoTime() + DEADLINE_NANOS));
        var result = new StringBuilder();
        int copiedUpTo = 0;
        try {
            while (matcher.find()) {
                result.append(input, copiedUpTo, matcher.start());
                for (var part : parts) {
                    checkLength(result);
                    switch (part) {
                        case Literal literal -> result.append(literal.text());
                        case Group group -> {
                            // A group that did not take part adds nothing, as in Java.
                            if (matcher.start(group.number()) >= 0) {
                                result.append(input, matcher.start(group.number()), matcher.end(group.number()));
                            }
                        }
                    }
                }
                checkLength(result);
                copiedUpTo = matcher.end();
            }
        } catch (StackOverflowError e) {
            // The engine recurses once per repetition of a group; the matcher is local, so nothing is left broken.
            throw new PatternTimeoutException("Pattern is too complex for this text.");
        }
        return result.append(input, copiedUpTo, input.length()).toString();
    }

    /** A group can capture past its match (in a lookahead), so the limit is checked while building. */
    private static void checkLength(StringBuilder out) {
        if (out.length() > Limits.DEFAULT.maxInputLength()) {
            throw new ResultTooLongException();
        }
    }

    private static Pattern compile(FieldValues values) {
        int flags = values.bool("ignoreCase") ? Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE : 0;
        return Pattern.compile(values.string("pattern"), flags);
    }

    private sealed interface Part permits Literal, Group {}

    private record Literal(String text) implements Part {}

    private record Group(int number) implements Part {}

    /**
     * Parses a replacement by the rules of {@link java.util.regex.Matcher#appendReplacement}, so one Java would
     * reject is caught up front, even when nothing matches.
     *
     * @throws IllegalArgumentException with a message for the user when the replacement is invalid
     */
    private static List<Part> parse(String replacement, Pattern pattern) {
        var parts = new ArrayList<Part>();
        var literal = new StringBuilder();
        int length = replacement.length();
        int i = 0;
        while (i < length) {
            char c = replacement.charAt(i++);
            if (c == '\\') {
                if (i == length) {
                    throw new IllegalArgumentException("Replacement ends with a lone \\; write \\\\ for a backslash.");
                }
                literal.append(replacement.charAt(i++));
                continue;
            }
            if (c != '$') {
                literal.append(c);
                continue;
            }
            if (i == length) {
                throw new IllegalArgumentException("Replacement ends with a lone $; write \\$ for a dollar sign.");
            }
            int group;
            if (replacement.charAt(i) == '{') {
                int close = i + 1;
                while (close < length && isAsciiLetterOrDigit(replacement.charAt(close))) {
                    close++;
                }
                if (close == i + 1 || close == length || replacement.charAt(close) != '}'
                        || isAsciiDigit(replacement.charAt(i + 1))) {
                    throw new IllegalArgumentException("Write a group name as ${name}.");
                }
                var name = replacement.substring(i + 1, close);
                var index = pattern.namedGroups().get(name);
                if (index == null) {
                    throw new IllegalArgumentException("There is no group named \"" + name + "\".");
                }
                group = index;
                i = close + 1;
            } else {
                if (!isAsciiDigit(replacement.charAt(i))) {
                    throw new IllegalArgumentException(
                            "\"$" + replacement.charAt(i) + "\" isn't a group reference; write \\$ for a dollar sign.");
                }
                // The first digit is always the group; later ones join it only while that group exists.
                int groupCount = pattern.matcher("").groupCount();
                group = replacement.charAt(i++) - '0';
                while (i < length && isAsciiDigit(replacement.charAt(i))
                        && group * 10 + (replacement.charAt(i) - '0') <= groupCount) {
                    group = group * 10 + (replacement.charAt(i++) - '0');
                }
                if (group > groupCount) {
                    throw new IllegalArgumentException("There is no group " + group + ".");
                }
            }
            if (!literal.isEmpty()) {
                parts.add(new Literal(literal.toString()));
                literal.setLength(0);
            }
            parts.add(new Group(group));
        }
        if (!literal.isEmpty()) {
            parts.add(new Literal(literal.toString()));
        }
        return parts;
    }

    private static boolean isAsciiDigit(char c) {
        return c >= '0' && c <= '9';
    }

    private static boolean isAsciiLetterOrDigit(char c) {
        return isAsciiDigit(c) || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }
}
