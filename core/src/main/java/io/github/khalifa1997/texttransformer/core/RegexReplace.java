package io.github.khalifa1997.texttransformer.core;

import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
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
        try {
            compile(values);
            return List.of();
        } catch (PatternSyntaxException e) {
            return List.of(new FieldProblem("pattern", ErrorCode.INVALID_PATTERN, e.getDescription()));
        }
    }

    @Override
    public String apply(String input, FieldValues values) {
        var replacement = values.string("replacement");
        var text = new DeadlineCharSequence(input, System.nanoTime() + DEADLINE_NANOS);
        var matcher = compile(values).matcher(text);
        var result = new StringBuilder();
        int copiedUpTo = 0;
        try {
            while (matcher.find()) {
                result.append(input, copiedUpTo, matcher.start());
                expand(replacement, matcher, input, result);
                copiedUpTo = matcher.end();
            }
        } catch (StackOverflowError e) {
            // The engine recurses once per repetition of a group; the matcher is local, so nothing is left broken.
            throw new PatternTimeoutException("Pattern is too complex for this text.");
        }
        return result.append(input, copiedUpTo, input.length()).toString();
    }

    /** {@code $`} and {@code $'} copy up to the whole input per token per match, so the limit is checked while building. */
    private static void checkLength(StringBuilder out) {
        if (out.length() > Limits.DEFAULT.maxInputLength()) {
            throw new ResultTooLongException();
        }
    }

    private static Pattern compile(FieldValues values) {
        int flags = values.bool("ignoreCase") ? Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE : 0;
        return Pattern.compile(values.string("pattern"), flags);
    }

    /** Expands JS-style tokens; anything that is not a token with a real target is copied as is. */
    private static void expand(String replacement, Matcher matcher, String input, StringBuilder out) {
        int length = replacement.length();
        int i = 0;
        while (i < length) {
            checkLength(out);
            char c = replacement.charAt(i);
            if (c != '$' || i + 1 == length) {
                out.append(c);
                i++;
                continue;
            }
            char next = replacement.charAt(i + 1);
            switch (next) {
                case '$' -> {
                    out.append('$');
                    i += 2;
                }
                case '&' -> {
                    out.append(input, matcher.start(), matcher.end());
                    i += 2;
                }
                case '`' -> {
                    out.append(input, 0, matcher.start());
                    i += 2;
                }
                case '\'' -> {
                    out.append(input, matcher.end(), input.length());
                    i += 2;
                }
                case '<' -> i = expandNamedGroup(replacement, i, matcher, out);
                default -> i = next >= '0' && next <= '9'
                        ? expandNumberedGroup(replacement, i, matcher, out)
                        : literalDollar(out, i);
            }
        }
        checkLength(out);
    }

    private static int literalDollar(StringBuilder out, int i) {
        out.append('$');
        return i + 1;
    }

    /** {@code $nn} wins over {@code $n} when group nn exists, so {@code $10} with one group is group 1 then "0". */
    private static int expandNumberedGroup(String replacement, int i, Matcher matcher, StringBuilder out) {
        int groupCount = matcher.groupCount();
        int oneDigit = replacement.charAt(i + 1) - '0';
        if (i + 2 < replacement.length()) {
            char second = replacement.charAt(i + 2);
            int twoDigits = oneDigit * 10 + (second - '0');
            if (second >= '0' && second <= '9' && twoDigits >= 1 && twoDigits <= groupCount) {
                appendGroup(matcher, twoDigits, out);
                return i + 3;
            }
        }
        if (oneDigit >= 1 && oneDigit <= groupCount) {
            appendGroup(matcher, oneDigit, out);
            return i + 2;
        }
        return literalDollar(out, i);
    }

    private static int expandNamedGroup(String replacement, int i, Matcher matcher, StringBuilder out) {
        int close = replacement.indexOf('>', i + 2);
        var namedGroups = matcher.pattern().namedGroups();
        if (close > 0 && !namedGroups.isEmpty()) {
            var index = namedGroups.get(replacement.substring(i + 2, close));
            if (index != null) {
                appendGroup(matcher, index, out);
                return close + 1;
            }
        }
        return literalDollar(out, i);
    }

    private static void appendGroup(Matcher matcher, int group, StringBuilder out) {
        var text = matcher.group(group);
        if (text != null) {
            out.append(text);
        }
    }
}
