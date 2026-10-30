package io.github.khalifa1997.texttransformer.core;

import java.util.List;

/** What running a Chain produced. */
public sealed interface RunResult {

    /**
     * The Chain ran to the end.
     *
     * @param output the Output: the last Step's result, or the Input text for an empty Chain
     * @param stepOutputs each Step's result, in Chain order
     */
    record Completed(String output, List<String> stepOutputs) implements RunResult {
        public Completed {
            stepOutputs = List.copyOf(stepOutputs);
        }
    }

    /** The Chain could not run. No Output or partial Step results are exposed. */
    record Rejected(List<RunError> errors) implements RunResult {
        public Rejected {
            errors = List.copyOf(errors);
        }
    }
}
