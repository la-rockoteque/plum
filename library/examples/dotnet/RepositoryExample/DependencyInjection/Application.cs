namespace RepositoryExample.DependencyInjection.Application;

public interface INotifier
{
    void Send(string message);
}

// The application owns its contract and receives an implementation.
public sealed class WelcomeUser(INotifier notifier)
{
    public void Execute(string name)
    {
        name = name.Trim();
        if (name.Length == 0) throw new ArgumentException("Name is required", nameof(name));
        notifier.Send($"Welcome, {name}!");
    }
}
