package io.github.khalifa1997.texttransformer.core;

/** A problem that stops a Chain from running. */
public sealed interface RunError permits InputError, StepError {
    ErrorCode code();
    String message();
}
