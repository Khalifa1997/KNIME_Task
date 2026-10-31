package io.github.khalifa1997.texttransformer.core;

/**
 * Wraps the text a pattern runs over so that reading it past the deadline throws {@link
 * PatternTimeoutException}. This is how a runaway pattern is stopped, since the regex engine has
 * no timeout of its own.
 */
final class DeadlineCharSequence implements CharSequence {

    private static final int READS_BETWEEN_CLOCK_CHECKS = 1_024;

    private final CharSequence text;
    private final long deadlineNanos;
    private int reads;

    DeadlineCharSequence(CharSequence text, long deadlineNanos) {
        this.text = text;
        this.deadlineNanos = deadlineNanos;
    }

    @Override
    public char charAt(int index) {
        if (++reads % READS_BETWEEN_CLOCK_CHECKS == 0 && System.nanoTime() - deadlineNanos > 0) {
            throw new PatternTimeoutException();
        }
        return text.charAt(index);
    }

    @Override
    public int length() {
        return text.length();
    }

    @Override
    public CharSequence subSequence(int start, int end) {
        return new DeadlineCharSequence(text.subSequence(start, end), deadlineNanos);
    }

    @Override
    public String toString() {
        return text.toString();
    }
}
