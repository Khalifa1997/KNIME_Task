# Text Transformer

A no-code tool for building an ordered series of text changes and running text through it.

## Language

**Transformation**:
A kind of change that can be applied to text, such as Replace or Uppercase, as described by the backend.
_Avoid_: Operation, node type

**Field**:
A configurable setting a Transformation declares, such as Replace's search text.
_Avoid_: Parameter, argument, option

**Step**:
One use of a Transformation in a Chain, holding its own Field values.
_Avoid_: Node, operation, block

**Chain**:
The ordered list of Steps that text passes through, each Step receiving the previous Step's result.
_Avoid_: Pipeline, workflow, recipe

**Input text**:
The text a Chain starts from.
_Avoid_: Source, initial value

**Output**:
The text that comes out of the last Step of a Chain.
_Avoid_: Result (when meaning the final text)

**Step error**:
A problem with one Step's Field values that stops the Chain from running, reported against that Step.
_Avoid_: Validation failure, node error
