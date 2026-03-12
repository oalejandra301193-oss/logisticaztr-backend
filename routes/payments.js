router.post("/crear-pago", async(req,res)=>{

const trip = await Trip.findById(req.body.tripId);
const amount = trip.valor * 0.05;
const request = new paypal.orders.OrdersCreateRequest();
const Trip = require("../models/Trip");
const paypal = require("@paypal/checkout-server-sdk");

const environment = new paypal.core.SandboxEnvironment(
process.env.PAYPAL_CLIENT,
process.env.PAYPAL_SECRET
);

const client = new paypal.core.PayPalHttpClient(environment);

request.requestBody({
intent:"CAPTURE",
purchase_units:[{
amount:{
currency_code:"USD",
value:amount.toFixed(2)
}
}]
});

const order = await client.execute(request);

res.json({id:order.result.id});

});