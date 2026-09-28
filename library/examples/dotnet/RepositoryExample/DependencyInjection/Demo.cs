using RepositoryExample.DependencyInjection.Application;
using RepositoryExample.DependencyInjection.Infrastructure;

namespace RepositoryExample.DependencyInjection;

public static class Demo
{
    public static void Run(string[] args)
    {
        // Composition root: construction belongs at the edge of the application.
        switch (args)
        {
            case ["before"]:
                new Before.WelcomeUser().Execute("Ada");
                break;
            case ["injection"]:
                new InjectionOnly.WelcomeUser(new ConsoleNotifier()).Execute("Ada");
                break;
            case ["console"]:
                new WelcomeUser(new ConsoleNotifier()).Execute("Ada");
                break;
            case ["recording"]:
                var notifier = new RecordingNotifier();
                new WelcomeUser(notifier).Execute("Ada");
                Console.WriteLine($"Recorded: {notifier.Messages[0]}");
                break;
            default:
                Console.Error.WriteLine("Usage: dotnet run -- di before|injection|console|recording");
                Environment.ExitCode = 1;
                break;
        }
    }
}
