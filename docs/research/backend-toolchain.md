# Backend toolchain: Java LTS, Spring Boot, build tool, ProblemDetail, validation

Question (issue #2): what backend toolchain should the plan pin, and do the pieces work together today (2026-10-25)? Versions were checked against primary sources on that date.

## Java

- **Java 25 is the current LTS.** Oracle lists 8, 11, 17, 21 and 25 as LTS releases. The next planned LTS is Java 29 in September 2027. ([Oracle Java SE Support Roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html))
- Java 26 and 27 are non-LTS. 27 came out 2026-09-15 and 26 is already out of support. ([Oracle roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html); [endoflife.date/oracle-jdk](https://endoflife.date/oracle-jdk))
- Oracle JDK 25 is free to use under the No-Fee Terms and Conditions licence until September 2028. Updates after that move to the OTN licence. Any OpenJDK build (for example Temurin) avoids the licence question altogether. ([Oracle roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html))
- Latest 25 update: 25.0.5, released 2026-10-21. ([endoflife.date/oracle-jdk](https://endoflife.date/oracle-jdk))

## Spring Boot

- **Spring Boot 4.1.x is the current GA line.** Latest patch: 4.1.2, released 2026-10-22. ([GitHub release v4.1.2](https://github.com/spring-projects/spring-boot/releases/tag/v4.1.2); [spring.io generations API](https://api.spring.io/projects/spring-boot/generations))
- 4.1.2 "requires at least Java 17 and is compatible with versions up to and including Java 27". So Java 25 is supported. It requires Spring Framework 7.0.10 or later. ([Spring Boot System Requirements](https://docs.spring.io/spring-boot/system-requirements.html))
- OSS support for 4.1.x ends 2027-07-31. 4.0.x ends 2026-12-31. 3.5.x already ended on 2026-06-30. ([spring.io generations API](https://api.spring.io/projects/spring-boot/generations))
- 4.2.0-RC1 shipped on 2026-10-22, and 4.2.x GA is scheduled for 2026-11-30. Moving from 4.1 to 4.2 should be a minor bump. Don't wait for it. ([GitHub releases](https://github.com/spring-projects/spring-boot/releases); [spring.io generations API](https://api.spring.io/projects/spring-boot/generations))
- Boot 4.1.2 manages `jakarta.validation-api` 3.1.1 and `hibernate-validator` 9.1.5.Final. ([Boot dependency versions](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html))

## Build: Maven vs Gradle

- **Both work with Boot 4.1.2.** Boot supports Maven 3.6.3+ and Gradle 8.14+ / 9.x. ([System Requirements](https://docs.spring.io/spring-boot/system-requirements.html))
- Current versions: Maven 3.10.0 is "the recommended version for all users". Maven 4 is still in RC and marked "NOT safe for production use". ([Maven download](https://maven.apache.org/download.cgi)) Gradle is at 9.8.2. ([services.gradle.org](https://services.gradle.org/versions/current)) Gradle needs 9.1.0+ to run on Java 25. ([Gradle compatibility matrix](https://docs.gradle.org/current/userguide/compatibility.html))
- **Maven multi-module:** the reactor collects the modules and sorts them into build order, so `app` depends on `core` and both build from the root. ([Maven multi-module guide](https://maven.apache.org/guides/mini/guide-multiple-modules.html)) Boot versions come from `spring-boot-starter-parent` or from importing `spring-boot-dependencies`. ([Boot Maven plugin: using](https://docs.spring.io/spring-boot/maven-plugin/using.html)) The enforcer `bannedDependencies` rule can fail the `core` build if any `org.springframework*` artifact shows up there. That keeps the library Spring-free mechanically. ([Enforcer bannedDependencies](https://maven.apache.org/enforcer/enforcer-rules/bannedDependencies.html))
- **Gradle multi-project:** `java-library` separates `api` from `implementation` dependencies, so internals don't leak onto consumers' compile classpath. ([Gradle Java Library plugin](https://docs.gradle.org/current/userguide/java_library_plugin.html)) Boot versions come from the `io.spring.dependency-management` plugin or a native `platform(...)` BOM. ([Boot Gradle plugin: managing dependencies](https://docs.spring.io/spring-boot/gradle-plugin/managing-dependencies.html))
- What actually differs for a two-module project: Maven's build is declarative XML, and the enforcer gives a ready-made "no Spring in core" guard. Gradle builds faster incrementally and has the cleaner `api`/`implementation` split. With only two modules, Gradle's speed advantage hardly matters.

## Errors: ProblemDetail with a custom `errors[]`

- **Yes, an `errors[]` member is supported in two ways.** (1) `ProblemDetail.setProperty("errors", list)`: with Jackson, Spring registers `ProblemDetailJacksonMixin`, which unwraps the `properties` map into top-level JSON members. (2) Subclass `ProblemDetail` and add a typed `errors` field. A copy constructor exists so an `@ControllerAdvice` can rebuild a ProblemDetail as the subclass. ([Spring MVC: Error Responses, Non-Standard Fields](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html); [`ProblemDetail.java` v7.0.10](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-web/src/main/java/org/springframework/http/ProblemDetail.java))
- RFC 9457 allows extension members (§3.2), and clients MUST ignore extensions they don't recognise. Its own validation example uses an `errors` array of `{detail, pointer}` objects, with JSON Pointers into the request. That maps directly onto per-Step and per-Field errors (`#/steps/2/fields/search`). ([RFC 9457 §3, §3.2](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.2))
- The RFC recommends against "batch" problem types that mix unrelated problems (§3). Several Step errors under one "invalid Chain" type are fine. ([RFC 9457 §3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3))
- Boot only turns on its own ProblemDetail handler when `spring.mvc.problemdetails.enabled=true`. If you add your own handler for a built-in exception, it must be ordered ahead of Boot's handler (order 0), or else extend `ResponseEntityExceptionHandler`. ([Spring MVC: Error Responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html); [Boot servlet web docs](https://docs.spring.io/spring-boot/reference/web/servlet.html))
- Out of the box, `MethodArgumentNotValidException` returns `detail: "Invalid request content."` with no per-field list. The `errors[]` member has to be built from the `BindingResult` ourselves. ([`MethodArgumentNotValidException.java` v7.0.10](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-web/src/main/java/org/springframework/web/bind/MethodArgumentNotValidException.java))

## Validation: Bean Validation for Steps

- **What it gives us:** `@Valid` cascades through object graphs, including container elements. `List<@NotNull @Valid Step> steps` validates every Step, and each violation's property path (e.g. `steps[2].transformation`) says which Step failed. ([Hibernate Validator 9.1 guide §2.1.3, §2.1.6, §2.2.3](https://docs.hibernate.org/validator/9.1/reference/en-US/html_single/))
- Class-level constraints see the whole object and can emit violations against named sub-properties (`addPropertyNode(...)`). ([HV guide §2.1.4, §6.2](https://docs.hibernate.org/validator/9.1/reference/en-US/html_single/))
- Hibernate Validator's `DefaultGroupSequenceProvider` can change which groups run based on object state. ([HV guide §5.4](https://docs.hibernate.org/validator/9.1/reference/en-US/html_single/))
- **Limits for Transformation-dependent Field rules:** constraints are annotations on Java types and properties. If a Step stores its Field values generically (e.g. `Map<String, Object>`), no annotation can say "Replace requires `search`". The only in-framework options are:
  - a class-level `@ValidStep` validator that looks up the Transformation's Field definitions and emits one violation per bad Field, which duplicates logic the library already owns; or
  - one Java type per Transformation (polymorphic JSON), which turns every new Transformation into DTO and annotation work.
  ([HV guide §2.1.4, §6.2](https://docs.hibernate.org/validator/9.1/reference/en-US/html_single/))
- Bean Validation also cannot express rules that only show up when a Transformation runs, such as an invalid regex pattern. Those have to come from the library.

## Recommendation

- **Pin Java 25 (LTS) + Spring Boot 4.1.2 (Framework 7.0.x) + Maven 3.10.x.** Use a root aggregator POM with two modules: `core` (plain Java, enforcer bans `org.springframework*`) and `app` (Boot, depends on `core`). Maven's enforcer guard and declarative build suit two modules better than Gradle's speed does. Move to Boot 4.2 after it goes GA on 2026-11-30 if convenient.
- **Errors:** return `application/problem+json` with a typed `ProblemDetail` subclass, or `setProperty("errors", …)`, carrying `errors: [{ step, field, detail, pointer }]`. This follows the RFC 9457 §3 example.
- **Validation:** use Bean Validation only for request shape (non-null Chain, non-blank Transformation id, size caps), with `List<@Valid Step>`. Put Transformation-dependent Field checks in the Spring-free library. It returns a list of Step errors, and `app` maps both sources into the same `errors[]`. That keeps the library free of Spring and of a hard `jakarta.validation` dependency, with one place that knows each Transformation's Fields.
