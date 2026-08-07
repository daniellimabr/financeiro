import { usePluggyItems } from "../hooks/usePluggyItems";
import { usePluggyTransactions } from "../hooks/usePluggyTransactions";
import { useSyncPluggyItem } from "../hooks/useSyncPluggyItem";

export function TransactionsPage() {
  const { data: items } = usePluggyItems();
  const { data: transactions, isLoading } = usePluggyTransactions();
  const syncItem = useSyncPluggyItem();

  return (
    <section>
      <h2>Transações</h2>

      <div>
        {items?.map((item) => (
          <button
            key={item.id}
            onClick={() => syncItem.mutate(item.id)}
            disabled={syncItem.isPending}
          >
            Sincronizar {item.connector_name}
          </button>
        ))}
      </div>
      {syncItem.isError && <p role="alert">Não foi possível sincronizar a conta.</p>}

      {isLoading && <p>Carregando...</p>}
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions?.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.data}</td>
              <td>{transaction.descricao}</td>
              <td>{transaction.valor}</td>
              <td>{transaction.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
