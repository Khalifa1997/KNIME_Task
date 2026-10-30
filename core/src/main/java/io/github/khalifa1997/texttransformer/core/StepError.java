package io.github.khalifa1997.texttransformer.core;

/** A problem at a zero-based Step index; null field means the whole Step. */
public record StepError(int stepIndex, String field, ErrorCode code, String message) implements RunError {}
