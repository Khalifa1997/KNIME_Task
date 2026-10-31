package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.ContentCheckUnavailableException;
import io.github.khalifa1997.texttransformer.core.ContentChecker;

/** The Content check on a server with no OpenAI API key: it can't answer, so a run that asks for it is refused. */
final class UnavailableContentChecker implements ContentChecker {

    @Override
    public boolean flags(String text) {
        throw new ContentCheckUnavailableException("No OpenAI API key is configured");
    }
}
