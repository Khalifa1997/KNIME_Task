package io.github.khalifa1997.texttransformer.app;

import io.github.khalifa1997.texttransformer.core.ContentCheckUnavailableException;
import java.util.Comparator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.exc.MismatchedInputException;

/** Safe request-shape errors, framework HTTP problems, and a logged unexpected boundary. */
@RestControllerAdvice
class HttpProblemAdvice extends ResponseEntityExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(HttpProblemAdvice.class);
    private static final String INVALID_JSON = "Request body is not valid JSON.";

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception, HttpHeaders headers,
            HttpStatusCode status, WebRequest request) {
        var detail = exception.getBindingResult().getFieldErrors().stream()
                .sorted(Comparator.comparing(org.springframework.validation.FieldError::getField)
                        .thenComparing(error -> String.valueOf(error.getCode())))
                .map(error -> "UniqueStepIds".equals(error.getCode())
                        ? "Step ids must be unique."
                        : "Invalid value at " + error.getField().replace(".<list element>", "") + ".")
                .findFirst().orElse(INVALID_JSON);
        return handleExceptionInternal(exception, ProblemDetail.forStatusAndDetail(status, detail), headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException exception, HttpHeaders headers,
            HttpStatusCode status, WebRequest request) {
        String detail = INVALID_JSON;
        // Parser syntax errors have no reliable property path. Never expose parser messages or input.
        if (exception.getCause() instanceof MismatchedInputException mismatch) {
            var path = safePath(mismatch);
            if (!path.isEmpty()) detail = "Invalid value at " + path + ".";
        }
        return handleExceptionInternal(exception, ProblemDetail.forStatusAndDetail(status, detail), headers, status, request);
    }

    private static String safePath(JacksonException exception) {
        var path = new StringBuilder();
        for (var reference : exception.getPath()) {
            var name = reference.getPropertyName();
            if (name != null) {
                if (!java.util.Set.of("inputText", "steps", "id", "transformationId", "values").contains(name)) break;
                if (!path.isEmpty()) path.append('.');
                path.append(name);
            } else if (reference.getIndex() >= 0) {
                path.append('[').append(reference.getIndex()).append(']');
            }
        }
        return path.toString();
    }

    @ExceptionHandler(ContentCheckUnavailableException.class)
    ResponseEntity<ProblemDetail> contentCheckUnavailable(ContentCheckUnavailableException exception) {
        LOG.warn("Content check unavailable", exception);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                        "The Content check could not be reached, so nothing was run."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> unexpected(Exception exception) {
        LOG.error("Unexpected HTTP request failure", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong."));
    }
}
