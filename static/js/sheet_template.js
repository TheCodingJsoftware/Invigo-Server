document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.add-quantity-button').forEach(button => {
        button.addEventListener('click', function () {
            const incomingQuantity = parseFloat(this.getAttribute('data-quantity'), 10);
            const orderPendingDate = this.getAttribute('data-order-pending-date');
            const expectedArrivalTime = this.getAttribute('data-expected-arrival-time');
            const orderNotes = this.getAttribute('data-notes');
            const currentQuantity = parseFloat(document.body.getAttribute(
                'data-current-quantity'), 10);

            const newTotalQuantity = currentQuantity + incomingQuantity;
            document.getElementById('modalQuantity').value = newTotalQuantity;
            // Set the hidden fields with the order details
            document.getElementById('orderPendingQuantity').value = incomingQuantity;
            document.getElementById('orderPendingDate').value = orderPendingDate;
            document.getElementById('expectedArrivalTime').value = expectedArrivalTime;
            document.getElementById('orderNotes').value = orderNotes;
            ui("#confirmationModal");
        });
    });
});
