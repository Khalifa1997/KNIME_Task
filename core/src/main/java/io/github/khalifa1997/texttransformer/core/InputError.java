package io.github.khalifa1997.texttransformer.core;

/** A problem with Input text or the Chain as a whole. */
public record InputError(ErrorCode code, String message) implements RunError {}
