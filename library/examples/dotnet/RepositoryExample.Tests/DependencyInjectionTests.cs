using RepositoryExample.DependencyInjection.Application;
using RepositoryExample.DependencyInjection.Infrastructure;
using Xunit;

namespace RepositoryExample.Tests;

public class DependencyInjectionTests
{
    [Fact]
    public void InjectedRecorderReceivesMessage()
    {
        var notifier = new RecordingNotifier();
        new WelcomeUser(notifier).Execute("  Ada  ");
        Assert.Equal(new[] { "Welcome, Ada!" }, notifier.Messages);
    }

    [Fact]
    public void InvalidNameDoesNotNotify()
    {
        var notifier = new RecordingNotifier();
        Assert.Throws<ArgumentException>(() => new WelcomeUser(notifier).Execute(" \t "));
        Assert.Empty(notifier.Messages);
    }

    [Fact]
    public void NotifierFailureReachesCaller()
    {
        var error = Assert.Throws<InvalidOperationException>(
            () => new WelcomeUser(new FailingNotifier()).Execute("Ada"));
        Assert.Equal("Delivery failed", error.Message);
    }

    private sealed class FailingNotifier : INotifier
    {
        public void Send(string message) => throw new InvalidOperationException("Delivery failed");
    }

    [Fact]
    public void ConsoleStagesPreserveBehavior()
    {
        var original = Console.Out;
        using var output = new StringWriter();
        try
        {
            Console.SetOut(output);
            new DependencyInjection.Before.WelcomeUser().Execute(" Ada ");
            new DependencyInjection.InjectionOnly.WelcomeUser(new ConsoleNotifier()).Execute(" Ada ");
            new WelcomeUser(new ConsoleNotifier()).Execute(" Ada ");
        }
        finally
        {
            Console.SetOut(original);
        }
        Assert.Equal(string.Concat(Enumerable.Repeat($"Welcome, Ada!{Environment.NewLine}", 3)),
            output.ToString());
    }
}
