package io.github.khalifa1997.texttransformer.app;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;
import java.util.HashSet;
import java.util.List;
import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Target({FIELD, PARAMETER})
@Retention(RUNTIME)
@Constraint(validatedBy = UniqueStepIds.Validator.class)
@interface UniqueStepIds {
    String message() default "Step ids must be unique.";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    final class Validator implements ConstraintValidator<UniqueStepIds, List<ChainController.StepJson>> {
        @Override
        public boolean isValid(List<ChainController.StepJson> steps, ConstraintValidatorContext context) {
            if (steps == null) return true;
            var ids = new HashSet<String>();
            for (var step : steps) {
                if (step != null && step.id() != null && !ids.add(step.id())) return false;
            }
            return true;
        }
    }
}
