plugins {
    kotlin("jvm") version "2.2.0"
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.xerial:sqlite-jdbc:3.53.4.0")
    implementation("org.jetbrains.exposed:exposed-core:1.0.0")
    implementation("org.jetbrains.exposed:exposed-jdbc:1.0.0")
    implementation("org.jetbrains.exposed:exposed-dao:1.0.0")
    runtimeOnly("org.slf4j:slf4j-nop:2.0.9")
    testImplementation(kotlin("test-junit"))
    testImplementation("io.kotest:kotest-property:6.2.5")
}

kotlin {
    jvmToolchain(17)
}

application {
    mainClass.set("example.DemoKt")
}

tasks.register<JavaExec>("diDemo") {
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("example.di.DemoKt")
    javaLauncher.set(javaToolchains.launcherFor {
        languageVersion.set(JavaLanguageVersion.of(17))
    })
}

tasks.register<JavaExec>("cqrsDemo") {
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("example.cqrs.DemoKt")
    javaLauncher.set(javaToolchains.launcherFor {
        languageVersion.set(JavaLanguageVersion.of(17))
    })
}

tasks.register<JavaExec>("ormDemo") {
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("example.orm.DemoKt")
    javaLauncher.set(javaToolchains.launcherFor {
        languageVersion.set(JavaLanguageVersion.of(17))
    })
}

tasks.register<JavaExec>("uowDemo") {
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("example.uow.DemoKt")
    javaLauncher.set(javaToolchains.launcherFor {
        languageVersion.set(JavaLanguageVersion.of(17))
    })
}
